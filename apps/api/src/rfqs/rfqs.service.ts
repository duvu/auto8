import { createHmac, timingSafeEqual } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { QuoteStatus, UserRole, type Prisma } from "@prisma/client";

import type {
  IntakeEmailInput,
  QuoteLineItemInput,
  RfqDetailView,
  RfqListItemView,
  SaveQuoteInput,
  SlackRfqIntakeInput
} from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";

const rfqDetailInclude = {
  intake: true,
  quote: {
    include: {
      lineItems: {
        orderBy: {
          sortOrder: "asc"
        }
      },
      statusEvents: {
        include: {
          actor: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  }
} satisfies Prisma.RfqInclude;

type RequestHeaders = Record<string, string | string[] | undefined>;

type NormalizedRfqIntake = {
  sourceType: "email" | "slack";
  sourceLabel: string;
  senderEmail: string | null;
  senderName: string | null;
  subject: string;
  body: string;
  receivedAt: string;
  rawPayload: string;
  slackWorkspaceId?: string | null;
  slackWorkspaceName?: string | null;
  slackChannelId?: string | null;
  slackChannelName?: string | null;
  slackSubmitterId?: string | null;
  slackSubmitterName?: string | null;
  slackSubmitterEmail?: string | null;
};

@Injectable()
export class RfqsService {
  constructor(private readonly prisma: PrismaService) {}

  async intakeEmail(input: IntakeEmailInput): Promise<RfqDetailView> {
    this.validateEmailIntake(input);

    return this.createRfqFromIntake({
      sourceType: "email",
      sourceLabel: "Email",
      senderEmail: input.fromEmail.trim().toLowerCase(),
      senderName: this.optionalString(input.fromName),
      subject: input.subject.trim(),
      body: input.body.trim(),
      receivedAt: input.receivedAt,
      rawPayload: JSON.stringify(input)
    });
  }

  async intakeSlack(input: SlackRfqIntakeInput, rawPayload: string, headers: RequestHeaders): Promise<RfqDetailView> {
    this.validateSlackIntake(input);
    this.verifySlackRequest(headers, rawPayload, input.workspaceId);

    return this.createRfqFromIntake({
      sourceType: "slack",
      sourceLabel: input.channelName?.trim() ? `Slack / #${input.channelName.trim()}` : "Slack",
      senderEmail: this.normalizeOptionalEmail(input.submitterEmail),
      senderName: this.optionalString(input.submitterName),
      subject: input.subject.trim(),
      body: input.body.trim(),
      receivedAt: input.submittedAt,
      rawPayload,
      slackWorkspaceId: input.workspaceId.trim(),
      slackWorkspaceName: this.optionalString(input.workspaceName),
      slackChannelId: input.channelId.trim(),
      slackChannelName: this.optionalString(input.channelName),
      slackSubmitterId: input.submitterId.trim(),
      slackSubmitterName: this.optionalString(input.submitterName),
      slackSubmitterEmail: this.normalizeOptionalEmail(input.submitterEmail)
    });
  }

  async listRfqs(): Promise<RfqListItemView[]> {
    const rfqs = await this.prisma.rfq.findMany({
      include: {
        intake: true
      },
      orderBy: {
        intake: {
          receivedAt: "desc"
        }
      }
    });

    return rfqs.map((rfq) => this.serializeRfqListItem(rfq));
  }

  async getRfqDetail(rfqId: string): Promise<RfqDetailView> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: rfqDetailInclude
    });

    if (!rfq) {
      throw new NotFoundException("RFQ not found.");
    }

    return this.serializeRfqDetail(rfq);
  }

  async saveDraft(rfqId: string, input: SaveQuoteInput, actorId?: string): Promise<RfqDetailView> {
    const actor = await this.requireUser(actorId);
    this.validateQuoteInput(input);

    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: {
        quote: true
      }
    });

    if (!rfq) {
      throw new NotFoundException("RFQ not found.");
    }

    if (rfq.quote?.status === QuoteStatus.pending_approval || rfq.quote?.status === QuoteStatus.approved) {
      throw new ConflictException("Only draft quotes can be edited.");
    }

    if (!rfq.quote) {
      await this.prisma.$transaction(async (tx) => {
        const quote = await tx.quote.create({
          data: {
            rfqId,
            customerName: input.customerName.trim(),
            customerCompany: input.customerCompany.trim(),
            notes: this.optionalString(input.notes),
            createdById: actor.id,
            lineItems: {
              create: input.lineItems.map((item, index) => this.serializeLineItemCreate(item, index))
            }
          }
        });

        await tx.quoteStatusEvent.create({
          data: {
            quoteId: quote.id,
            actorId: actor.id,
            status: QuoteStatus.draft
          }
        });

        await tx.rfq.update({
          where: { id: rfqId },
          data: {
            workflowState: "draft"
          }
        });
      });
    } else {
      const existingQuoteId = rfq.quote.id;

      await this.prisma.$transaction(async (tx) => {
        await tx.quote.update({
          where: { id: existingQuoteId },
          data: {
            customerName: input.customerName.trim(),
            customerCompany: input.customerCompany.trim(),
            notes: this.optionalString(input.notes),
            lineItems: {
              deleteMany: {},
              create: input.lineItems.map((item, index) => this.serializeLineItemCreate(item, index))
            }
          }
        });

        await tx.rfq.update({
          where: { id: rfqId },
          data: {
            workflowState: "draft"
          }
        });
      });
    }

    return this.getRfqDetail(rfqId);
  }

  async submitForApproval(quoteId: string, actorId?: string): Promise<RfqDetailView> {
    await this.requireUser(actorId);

    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        lineItems: true,
        rfq: true
      }
    });

    if (!quote) {
      throw new NotFoundException("Quote not found.");
    }

    if (quote.status !== QuoteStatus.draft) {
      throw new ConflictException("Only draft quotes can be submitted for approval.");
    }

    if (quote.lineItems.length === 0) {
      throw new BadRequestException("Draft quote must contain at least one line item.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          status: QuoteStatus.pending_approval,
          submittedAt: new Date()
        }
      });

      await tx.quoteStatusEvent.create({
        data: {
          quoteId,
          actorId,
          status: QuoteStatus.pending_approval
        }
      });

      await tx.rfq.update({
        where: { id: quote.rfqId },
        data: {
          workflowState: "pending_approval"
        }
      });
    });

    return this.getRfqDetail(quote.rfqId);
  }

  async approveQuote(quoteId: string, actorId?: string): Promise<RfqDetailView> {
    const actor = await this.requireUser(actorId);

    if (actor.role !== UserRole.sales_approver) {
      throw new ForbiddenException("Only sales approvers can approve quotes.");
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId }
    });

    if (!quote) {
      throw new NotFoundException("Quote not found.");
    }

    if (quote.status !== QuoteStatus.pending_approval) {
      throw new ConflictException("Only quotes pending approval can be approved.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          status: QuoteStatus.approved,
          approvedAt: new Date(),
          approvedById: actor.id
        }
      });

      await tx.quoteStatusEvent.create({
        data: {
          quoteId,
          actorId: actor.id,
          status: QuoteStatus.approved
        }
      });

      await tx.rfq.update({
        where: { id: quote.rfqId },
        data: {
          workflowState: "approved"
        }
      });
    });

    return this.getRfqDetail(quote.rfqId);
  }

  private async createRfqFromIntake(input: NormalizedRfqIntake): Promise<RfqDetailView> {
    const rfq = await this.prisma.$transaction(async (tx) => {
      const sequence = (await tx.rfq.count()) + 1001;
      const intake = await tx.rfqIntake.create({
        data: {
          sourceType: input.sourceType,
          sourceLabel: input.sourceLabel,
          senderEmail: input.senderEmail,
          senderName: input.senderName,
          subject: input.subject,
          body: input.body,
          receivedAt: new Date(input.receivedAt),
          rawPayload: input.rawPayload,
          slackWorkspaceId: input.slackWorkspaceId ?? null,
          slackWorkspaceName: input.slackWorkspaceName ?? null,
          slackChannelId: input.slackChannelId ?? null,
          slackChannelName: input.slackChannelName ?? null,
          slackSubmitterId: input.slackSubmitterId ?? null,
          slackSubmitterName: input.slackSubmitterName ?? null,
          slackSubmitterEmail: input.slackSubmitterEmail ?? null
        }
      });

      return tx.rfq.create({
        data: {
          intakeId: intake.id,
          reference: `RFQ-${String(sequence).padStart(4, "0")}`
        },
        include: rfqDetailInclude
      });
    });

    return this.serializeRfqDetail(rfq);
  }

  private async requireUser(actorId?: string) {
    if (!actorId) {
      throw new UnauthorizedException("Select a demo user before performing this action.");
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorId }
    });

    if (!actor) {
      throw new UnauthorizedException("Demo user not found.");
    }

    return actor;
  }

  private validateEmailIntake(input: IntakeEmailInput) {
    if (!input.fromEmail?.trim() || !input.subject?.trim() || !input.body?.trim() || !input.receivedAt?.trim()) {
      throw new BadRequestException("Inbound RFQ email requires sender, subject, body, and receivedAt.");
    }

    if (Number.isNaN(Date.parse(input.receivedAt))) {
      throw new BadRequestException("receivedAt must be an ISO-8601 timestamp.");
    }
  }

  private validateSlackIntake(input: SlackRfqIntakeInput) {
    if (
      !input.workspaceId?.trim() ||
      !input.channelId?.trim() ||
      !input.submitterId?.trim() ||
      !input.subject?.trim() ||
      !input.body?.trim() ||
      !input.submittedAt?.trim()
    ) {
      throw new BadRequestException(
        "Slack RFQ requires workspace, channel, submitter, subject, body, and submittedAt."
      );
    }

    if (Number.isNaN(Date.parse(input.submittedAt))) {
      throw new BadRequestException("submittedAt must be an ISO-8601 timestamp.");
    }
  }

  private verifySlackRequest(headers: RequestHeaders, rawPayload: string, workspaceId: string) {
    const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();

    if (!signingSecret) {
      throw new UnauthorizedException("Slack connector is not configured.");
    }

    const timestampHeader = this.readHeader(headers, "x-slack-request-timestamp");
    const signatureHeader = this.readHeader(headers, "x-slack-signature");

    if (!timestampHeader || !signatureHeader) {
      throw new UnauthorizedException("Slack signature headers are required.");
    }

    const timestamp = Number(timestampHeader);

    if (!Number.isInteger(timestamp)) {
      throw new UnauthorizedException("Slack request timestamp is invalid.");
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowInSeconds - timestamp) > 300) {
      throw new UnauthorizedException("Slack request timestamp is outside the allowed window.");
    }

    const allowedWorkspaceIds = (process.env.SLACK_ALLOWED_WORKSPACE_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (allowedWorkspaceIds.length > 0 && !allowedWorkspaceIds.includes(workspaceId.trim())) {
      throw new ForbiddenException("Slack workspace is not allowed.");
    }

    const expectedSignature = `v0=${createHmac("sha256", signingSecret)
      .update(`v0:${timestamp}:${rawPayload}`)
      .digest("hex")}`;

    const providedBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException("Slack request signature is invalid.");
    }
  }

  private readHeader(headers: RequestHeaders, name: string) {
    const value = headers[name.toLowerCase()] ?? headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private validateQuoteInput(input: SaveQuoteInput) {
    if (!input.customerName?.trim() || !input.customerCompany?.trim()) {
      throw new BadRequestException("Draft quote requires customer name and company.");
    }

    if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) {
      throw new BadRequestException("Draft quote requires at least one line item.");
    }

    input.lineItems.forEach((item, index) => this.validateLineItem(item, index));
  }

  private validateLineItem(item: QuoteLineItemInput, index: number) {
    if (!item.description?.trim()) {
      throw new BadRequestException(`Line item ${index + 1} requires a description.`);
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new BadRequestException(`Line item ${index + 1} requires a positive integer quantity.`);
    }

    if (!Number.isInteger(item.unitPrice) || item.unitPrice < 0) {
      throw new BadRequestException(`Line item ${index + 1} requires a non-negative integer unit price.`);
    }
  }

  private serializeLineItemCreate(item: QuoteLineItemInput, index: number) {
    return {
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sortOrder: index
    };
  }

  private serializeRfqListItem(rfq: {
    id: string;
    reference: string;
    workflowState: "new" | "draft" | "pending_approval" | "approved";
    intake: {
      sourceType: "email" | "slack";
      sourceLabel: string;
      senderEmail: string | null;
      senderName: string | null;
      subject: string;
      receivedAt: Date;
    };
  }): RfqListItemView {
    return {
      id: rfq.id,
      reference: rfq.reference,
      senderEmail: rfq.intake.senderEmail,
      senderName: rfq.intake.senderName,
      subject: rfq.intake.subject,
      receivedAt: rfq.intake.receivedAt.toISOString(),
      workflowState: rfq.workflowState,
      sourceType: rfq.intake.sourceType,
      sourceLabel: rfq.intake.sourceLabel
    };
  }

  private serializeRfqDetail(rfq: Prisma.RfqGetPayload<{ include: typeof rfqDetailInclude }>): RfqDetailView {
    return {
      ...this.serializeRfqListItem(rfq),
      body: rfq.intake.body,
      slackWorkspaceId: rfq.intake.slackWorkspaceId,
      slackWorkspaceName: rfq.intake.slackWorkspaceName,
      slackChannelId: rfq.intake.slackChannelId,
      slackChannelName: rfq.intake.slackChannelName,
      slackSubmitterId: rfq.intake.slackSubmitterId,
      slackSubmitterName: rfq.intake.slackSubmitterName,
      slackSubmitterEmail: rfq.intake.slackSubmitterEmail,
      quote: rfq.quote
        ? {
            id: rfq.quote.id,
            customerName: rfq.quote.customerName,
            customerCompany: rfq.quote.customerCompany,
            notes: rfq.quote.notes,
            status: rfq.quote.status,
            createdById: rfq.quote.createdById,
            approvedById: rfq.quote.approvedById,
            lineItems: rfq.quote.lineItems.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          }
        : null,
      history: rfq.quote
        ? rfq.quote.statusEvents.map((event) => ({
            id: event.id,
            status: event.status,
            actorName: event.actor?.name ?? null,
            actorRole: event.actor?.role ?? null,
            createdAt: event.createdAt.toISOString()
          }))
        : []
    };
  }

  private normalizeOptionalEmail(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }

  private optionalString(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
