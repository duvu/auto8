import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { type Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import type {
  IntakeEmailInput,
  PaginatedResponse,
  RfqDetailView,
  RfqListItemView,
} from "@auto8/shared";

import type { NormalizedRfqIntake } from "../connectors/connector.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { RfqExtractionService } from "./rfq-extraction.service";
import { RfqClassificationService } from "./rfq-classification.service";
import { JobsService } from "../jobs/jobs.service";

const VALID_PIPELINE_STATUSES = [
  "new",
  "classified",
  "needs_review",
  "ready_for_quote",
  "quote_draft_created",
  "quote_submitted",
  "approved",
  "sent",
  "closed",
] as const;

const rfqDetailInclude = {
  intake: true,
  quote: {
    include: {
      lineItems: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      statusEvents: {
        include: {
          actor: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      email: {
        include: {
          sends: true,
        },
      },
    },
  },
} satisfies Prisma.RfqInclude;

@Injectable()
export class RfqIntakeService {
  private readonly logger = new Logger(RfqIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rfqExtractionService: RfqExtractionService,
    private readonly rfqClassificationService: RfqClassificationService,
    private readonly jobsService: JobsService,
  ) {}

  async intakeEmail(input: IntakeEmailInput): Promise<RfqDetailView> {
    this.validateEmailIntake(input);

    const subject = input.subject.trim();
    const body = input.body.trim();
    const classification = await this.rfqClassificationService.classify(subject, body);

    return this.createRfqFromIntake({
      sourceType: "email",
      sourceLabel: "Email",
      senderEmail: input.fromEmail.trim().toLowerCase(),
      senderName: this.optionalString(input.fromName),
      subject,
      body,
      receivedAt: input.receivedAt,
      rawPayload: JSON.stringify(input),
      isRfq: classification.isRfq,
      classificationScore: classification.score,
      classificationReason: classification.reason,
    });
  }

  async listRfqs(
    isRfq?: boolean,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
    pipelineStatus?: string,
  ): Promise<PaginatedResponse<RfqListItemView>> {
    const whereConditions: Prisma.RfqWhereInput[] = [];

    if (isRfq !== undefined) {
      whereConditions.push({ intake: { isRfq } });
    }

    if (pipelineStatus !== undefined) {
      whereConditions.push({ intake: { rfqPipelineStatus: pipelineStatus } });
    }

    const where: Prisma.RfqWhereInput | undefined =
      whereConditions.length > 0 ? { AND: whereConditions } : undefined;

    const skip = (pagination.page - 1) * pagination.limit;

    const [rfqs, total] = await Promise.all([
      this.prisma.rfq.findMany({
        include: { intake: true },
        where,
        orderBy: { intake: { receivedAt: "desc" } },
        skip,
        take: pagination.limit,
      }),
      this.prisma.rfq.count({ where }),
    ]);

    return {
      data: rfqs.map((rfq) => this.serializeRfqListItem(rfq)),
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        hasMore: skip + rfqs.length < total,
      },
    };
  }

  async getRfqDetail(rfqId: string): Promise<RfqDetailView> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: rfqDetailInclude,
    });

    if (!rfq) {
      throw new NotFoundException("RFQ not found.");
    }

    return this.serializeRfqDetail(rfq);
  }

  async createRfqFromIntake(input: NormalizedRfqIntake): Promise<RfqDetailView> {
    const MAX_RETRIES = 5;

    // Determine initial pipeline status based on classification
    const pipelineStatus = input.isRfq === false ? "needs_review" : "classified";

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
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
              slackWorkspaceId: input.slackWorkspaceId,
              slackWorkspaceName: input.slackWorkspaceName,
              slackChannelId: input.slackChannelId,
              slackChannelName: input.slackChannelName,
              slackSubmitterId: input.slackSubmitterId,
              slackSubmitterName: input.slackSubmitterName,
              slackSubmitterEmail: input.slackSubmitterEmail,
              slackMessageId: input.slackMessageId,
              gmailMessageId: input.gmailMessageId,
              gmailThreadId: input.gmailThreadId,
              isRfq: input.isRfq ?? true,
              classificationScore: input.classificationScore ?? null,
              classificationReason: input.classificationReason ?? null,
              rfqPipelineStatus: pipelineStatus,
              connectorId: input.connectorId ?? null,
            },
          });

          // Create RfqAttachment records for any attachments
          if (input.attachments && input.attachments.length > 0) {
            await tx.rfqAttachment.createMany({
              data: input.attachments.map((att) => ({
                rfqIntakeId: intake.id,
                filename: att.filename,
                mimeType: att.mimeType,
                sizeBytes: att.sizeBytes,
                storagePath: att.storagePath,
              })),
            });
          }

          return tx.rfq.create({
            data: {
              intakeId: intake.id,
              reference: `RFQ-${String(sequence).padStart(4, "0")}`,
            },
            include: rfqDetailInclude,
          });
        });

        const detail = this.serializeRfqDetail(rfq);
        this.auditService.log({
          action: 'rfq.intake',
          resourceType: 'rfq',
          resourceId: rfq.id,
          before: null,
          after: { id: rfq.id, reference: rfq.reference, sourceType: rfq.intake.sourceType },
        });

        // If not a real RFQ (classified as non-RFQ), skip downstream workflow steps
        if (input.isRfq === false) {
          return detail;
        }

        // Enqueue attachment parse jobs for any attachments
        if (input.attachments && input.attachments.length > 0) {
          // Fetch created RfqAttachment IDs
          const attachments = await this.prisma.rfqAttachment.findMany({
            where: { rfqIntakeId: rfq.intakeId },
            select: { id: true },
          });
          for (const att of attachments) {
            this.jobsService.enqueue("attachment_parse", { rfqAttachmentId: att.id }).catch(
              (err: unknown) => this.logger.error("Failed to enqueue attachment_parse job", err),
            );
          }
        }

        this.rfqExtractionService.extractAsync(rfq.id).catch((err: unknown) => this.logger.error(err));
        return detail;
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === "P2002" && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException("Failed to generate unique RFQ reference after multiple attempts.");
  }

  async updatePipelineStatus(rfqId: string, status: string): Promise<void> {
    if (!VALID_PIPELINE_STATUSES.includes(status as (typeof VALID_PIPELINE_STATUSES)[number])) {
      throw new BadRequestException(
        `Invalid pipeline status: '${status}'. Valid values are: ${VALID_PIPELINE_STATUSES.join(", ")}`,
      );
    }

    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId }, select: { intakeId: true } });
    if (!rfq) {
      throw new NotFoundException("RFQ not found.");
    }

    await this.prisma.rfqIntake.update({
      where: { id: rfq.intakeId },
      data: { rfqPipelineStatus: status },
    });
  }

  private validateEmailIntake(input: IntakeEmailInput) {
    if (!input.fromEmail?.trim() || !input.subject?.trim() || !input.body?.trim() || !input.receivedAt?.trim()) {
      throw new BadRequestException("Inbound RFQ email requires sender, subject, body, and receivedAt.");
    }

    if (Number.isNaN(Date.parse(input.receivedAt))) {
      throw new BadRequestException("receivedAt must be an ISO-8601 timestamp.");
    }
  }

  serializeRfqListItem(rfq: {
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
      isRfq: boolean;
      classificationScore: number | null;
      rfqPipelineStatus: string;
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
      sourceLabel: rfq.intake.sourceLabel,
      isRfq: rfq.intake.isRfq,
      classificationScore: rfq.intake.classificationScore,
      rfqPipelineStatus: rfq.intake.rfqPipelineStatus,
    };
  }

  serializeRfqDetail(rfq: Prisma.RfqGetPayload<{ include: typeof rfqDetailInclude }>): RfqDetailView {
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
            discount: rfq.quote.discount,
            tax: rfq.quote.tax,
            grandTotal: rfq.quote.grandTotal,
            paymentTerms: rfq.quote.paymentTerms,
            deliveryTerms: rfq.quote.deliveryTerms,
            validityDays: rfq.quote.validityDays,
            lineItems: rfq.quote.lineItems.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: item.subtotal,
              productId: item.productId,
            })),
          }
        : null,
      history: rfq.quote
        ? rfq.quote.statusEvents.map((event) => ({
            id: event.id,
            status: event.status,
            actorName: event.actor?.name ?? null,
            actorRole: event.actor?.role ?? null,
            createdAt: event.createdAt.toISOString(),
          }))
        : [],
      emailSummary: (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emailRecord = (rfq.quote as any)?.email as
          | { sends: Array<{ status: string; sentAt: Date }> }
          | null
          | undefined;
        if (!emailRecord?.sends?.length) return null;
        const sentSends = emailRecord.sends.filter((s) => s.status === "sent");
        const errorSends = emailRecord.sends.filter((s) => s.status === "error");
        const lastSent = sentSends.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];
        return {
          totalSent: sentSends.length,
          totalErrors: errorSends.length,
          lastSentAt: lastSent?.sentAt.toISOString() ?? null,
        };
      })(),
    };
  }

  private optionalString(value: string | null | undefined) {
    return value?.trim() || null;
  }
}
