import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { type Prisma, RfqSourceType } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import type {
  IntakeEmailInput,
  PaginatedResponse,
  RfqDetailView,
  RfqListItemView,
  RfqPipelineStatus,
} from "@auto8/shared";
import { VALID_PIPELINE_STATUSES } from "@auto8/shared";

import type { NormalizedRfqIntake } from "../connectors/connector.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { RfqExtractionService } from "./rfq-extraction.service";
import { RfqClassificationService } from "./rfq-classification.service";
import { JobsService } from "../jobs/jobs.service";
import { optionalString } from "../common/utils/string.util";
import { SlaService } from "../sla/sla.service";

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
    private readonly slaService: SlaService,
  ) {}

  webhookEmitter?: { emit(event: string, payload: Record<string, unknown>): Promise<void> };

  async intakeEmail(input: IntakeEmailInput): Promise<RfqDetailView> {
    this.validateEmailIntake(input);

    return this.classifyAndIntake({
      sourceType: "email",
      sourceLabel: "Email",
      senderEmail: input.fromEmail.trim().toLowerCase(),
      senderName: optionalString(input.fromName),
      subject: input.subject.trim(),
      body: input.body.trim(),
      receivedAt: input.receivedAt,
      rawPayload: JSON.stringify(input),
    });
  }

  /**
   * Classifies a normalized intake and then persists it via createRfqFromIntake().
   * This is the single shared entry point for all intake sources (email, Gmail, Slack).
   * It ensures classification is applied uniformly before any record is created.
   */
  async classifyAndIntake(input: NormalizedRfqIntake): Promise<RfqDetailView> {
    const classification = await this.rfqClassificationService.classify(
      input.subject ?? "",
      input.body ?? "",
    );

    return this.createRfqFromIntake({
      ...input,
      isRfq: classification.isRfq,
      classificationScore: classification.score,
      classificationReason: classification.reason,
    });
  }

  async listRfqs(
    isRfq?: boolean,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
    pipelineStatus?: string,
    assignedToId?: string,
    includeReplies = false,
  ): Promise<PaginatedResponse<RfqListItemView>> {
    const whereConditions: Prisma.RfqWhereInput[] = [];

    if (!includeReplies) {
      (whereConditions as unknown as Array<Record<string, unknown>>).push({ intake: { isReply: false } });
    }

    if (isRfq !== undefined) {
      whereConditions.push({ intake: { isRfq } });
    }

    if (pipelineStatus !== undefined) {
      whereConditions.push({ intake: { rfqPipelineStatus: pipelineStatus } });
    }

    if (assignedToId !== undefined) {
      if (assignedToId === "unassigned") {
        (whereConditions as unknown as Array<Record<string, unknown>>).push({ assignedToId: null });
      } else {
        (whereConditions as unknown as Array<Record<string, unknown>>).push({ assignedToId });
      }
    }

    const where: Prisma.RfqWhereInput | undefined =
      whereConditions.length > 0 ? { AND: whereConditions } : undefined;

    const skip = (pagination.page - 1) * pagination.limit;

    const [rfqs, total] = await Promise.all([
      (this.prisma.rfq as unknown as { findMany: (args: unknown) => Promise<Array<{ id: string; reference: string; workflowState: "new" | "draft" | "pending_approval" | "approved"; assignedToId: string | null; assignedTo: { name: string } | null; expectedResponseBy: Date | null; intake: { sourceType: "email" | "slack" | "outlook" | "whatsapp" | "telegram"; sourceLabel: string; senderEmail: string | null; senderName: string | null; subject: string; receivedAt: Date; isRfq: boolean; classificationScore: number | null; rfqPipelineStatus: string } }>> }).findMany({
        include: { intake: true, assignedTo: { select: { id: true, name: true } } },
        where,
        orderBy: { intake: { receivedAt: "desc" } },
        skip,
        take: pagination.limit,
      }),
      this.prisma.rfq.count({ where }),
    ]);

    return buildPaginatedResponse(rfqs.map((rfq) => this.serializeRfqListItem(rfq)), total, pagination);
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

  async getReplies(rfqId: string): Promise<{ id: string; subject: string; senderName: string | null; body: string; receivedAt: string }[]> {
    const intakes = await this.prisma.rfqIntake.findMany({
      where: { replyToRfqId: rfqId },
      select: { id: true, subject: true, senderName: true, body: true, receivedAt: true },
      orderBy: { receivedAt: "asc" },
    });
    return intakes.map((i) => ({ ...i, receivedAt: i.receivedAt.toISOString() }));
  }

  async createRfqFromIntake(input: NormalizedRfqIntake): Promise<RfqDetailView> {
    const MAX_RETRIES = 5;

    // Determine initial pipeline status based on classification
    const pipelineStatus = input.isRfq === false ? "needs_review" : "classified";

    const expectedResponseBy = await this.slaService.computeExpectedResponseBy();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const rfq = await this.prisma.$transaction(async (tx) => {
          const sequence = (await tx.rfq.count()) + 1001;
          const intake = await tx.rfqIntake.create({
            data: {
              sourceType: input.sourceType as RfqSourceType,
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
              outlookMessageId: input.outlookMessageId ?? null,
              gmailThreadId: input.gmailThreadId,
              isReply: input.isReply ?? false,
              replyToRfqId: input.replyToRfqId ?? null,
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
            data: Object.assign(
              {
                intakeId: intake.id,
                reference: `RFQ-${String(sequence).padStart(4, "0")}`,
              },
              { expectedResponseBy } as Record<string, unknown>,
            ) as Parameters<typeof tx.rfq.create>[0]["data"],
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

        if (input.isRfq === false || input.isReply === true) {
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

        // Enqueue extraction as a background job only if there are no attachments
        // (if attachments exist, rfq_extract will be enqueued after all attachment_parse jobs settle)
        if (!input.attachments || input.attachments.length === 0) {
          this.jobsService.enqueue("rfq_extract", { rfqId: rfq.id }).catch((err: unknown) => this.logger.error("Failed to enqueue rfq_extract job", err));
        }
        this.webhookEmitter?.emit("rfq.created", { rfqId: rfq.id, reference: rfq.reference }).catch(
          (err: unknown) => this.logger.error("Failed to emit rfq.created webhook", err),
        );
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

  async updatePipelineStatus(rfqId: string, status: RfqPipelineStatus): Promise<void> {
    if (!VALID_PIPELINE_STATUSES.includes(status)) {
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

    // When manually reclassifying a needs_review RFQ back to classified,
    // enqueue rfq_extract if no pending/running job exists
    if (status === "classified") {
      const existingJob = await this.prisma.backgroundJob.findFirst({
        where: {
          type: "rfq_extract",
          status: { in: ["pending", "running"] },
          payload: { contains: rfqId },
        },
      });
      if (!existingJob) {
        this.jobsService.enqueue("rfq_extract", { rfqId }).catch(
          (err: unknown) => this.logger.error("Failed to enqueue rfq_extract after reclassification", err),
        );
      }
    }
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
    assignedToId?: string | null;
    assignedTo?: { name: string } | null;
    expectedResponseBy?: Date | null;
    intake: {
sourceType: "email" | "slack" | "outlook" | "whatsapp" | "telegram" | "zalo";
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
    const now = new Date();
    const expectedResponseBy = (rfq as unknown as { expectedResponseBy: Date | null }).expectedResponseBy;
    const assignedToId = (rfq as unknown as { assignedToId: string | null }).assignedToId;
    const assignedTo = (rfq as unknown as { assignedTo?: { name: string } | null }).assignedTo;
    const slaBreached = expectedResponseBy != null && expectedResponseBy < now;
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
      assignedToId: assignedToId ?? null,
      assignedToName: assignedTo?.name ?? null,
      expectedResponseBy: expectedResponseBy?.toISOString() ?? null,
      slaBreached,
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
            currency: rfq.quote.currency,
            exchangeRate: (rfq.quote as unknown as { exchangeRate: number }).exchangeRate ?? 1.0,
            customerId: (rfq.quote as unknown as { customerId: string | null }).customerId ?? null,
            paymentTerms: rfq.quote.paymentTerms,
            deliveryTerms: rfq.quote.deliveryTerms,
            validityDays: rfq.quote.validityDays,
            version: (rfq.quote as unknown as { version: number }).version ?? 1,
            parentQuoteId: (rfq.quote as unknown as { parentQuoteId: string | null }).parentQuoteId ?? null,
            lineItems: rfq.quote.lineItems.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: item.subtotal,
              productId: item.productId,
              suggestedPrice: null,
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
}
