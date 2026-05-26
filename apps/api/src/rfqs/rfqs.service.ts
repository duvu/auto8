import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { QuoteStatus, UserRole, type Prisma } from "@prisma/client";

import type { IntakeEmailInput, QuoteLineItemInput, RfqDetailView, RfqListItemView, SaveQuoteInput } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";

const rfqDetailInclude = {
  email: true,
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

@Injectable()
export class RfqsService {
  constructor(private readonly prisma: PrismaService) {}

  async intakeEmail(input: IntakeEmailInput): Promise<RfqDetailView> {
    this.validateIntake(input);

    const rfq = await this.prisma.$transaction(async (tx) => {
      const sequence = (await tx.rfq.count()) + 1001;
      const email = await tx.rfqEmail.create({
        data: {
          fromEmail: input.fromEmail.trim().toLowerCase(),
          fromName: this.optionalString(input.fromName),
          subject: input.subject.trim(),
          body: input.body.trim(),
          receivedAt: new Date(input.receivedAt),
          rawPayload: JSON.stringify(input)
        }
      });

      return tx.rfq.create({
        data: {
          emailId: email.id,
          reference: `RFQ-${String(sequence).padStart(4, "0")}`
        },
        include: rfqDetailInclude
      });
    });

    return this.serializeRfqDetail(rfq);
  }

  async listRfqs(): Promise<RfqListItemView[]> {
    const rfqs = await this.prisma.rfq.findMany({
      include: {
        email: true
      },
      orderBy: {
        email: {
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
      await this.prisma.$transaction(async (tx) => {
        await tx.quote.update({
          where: { id: rfq.quote!.id },
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

  private validateIntake(input: IntakeEmailInput) {
    if (!input.fromEmail?.trim() || !input.subject?.trim() || !input.body?.trim() || !input.receivedAt?.trim()) {
      throw new BadRequestException("Inbound RFQ email requires sender, subject, body, and receivedAt.");
    }

    if (Number.isNaN(Date.parse(input.receivedAt))) {
      throw new BadRequestException("receivedAt must be an ISO-8601 timestamp.");
    }
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
    email: {
      fromEmail: string;
      fromName: string | null;
      subject: string;
      receivedAt: Date;
    };
  }): RfqListItemView {
    return {
      id: rfq.id,
      reference: rfq.reference,
      senderEmail: rfq.email.fromEmail,
      senderName: rfq.email.fromName,
      subject: rfq.email.subject,
      receivedAt: rfq.email.receivedAt.toISOString(),
      workflowState: rfq.workflowState
    };
  }

  private serializeRfqDetail(rfq: Prisma.RfqGetPayload<{ include: typeof rfqDetailInclude }>): RfqDetailView {
    return {
      ...this.serializeRfqListItem(rfq),
      body: rfq.email.body,
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

  private optionalString(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
