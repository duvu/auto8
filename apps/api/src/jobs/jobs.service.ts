import { forwardRef, Inject, Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AttachmentService } from "../attachments/attachment.service";
import { ItemMatchingService } from "../matching/item-matching.service";
import { SheetExportService } from "../sheet-export/sheet-export.service";
import { AuditService } from "../audit/audit.service";
import { RfqExtractionService } from "../rfqs/rfq-extraction.service";

export type JobType = "attachment_parse" | "item_match" | "sheet_export" | "rfq_extract";

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);
  private handlers: Map<JobType, (payload: Record<string, unknown>) => Promise<void>> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentService: AttachmentService,
    @Optional() private readonly itemMatchingService?: ItemMatchingService,
    @Optional() private readonly sheetExportService?: SheetExportService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() @Inject(forwardRef(() => RfqExtractionService)) private readonly rfqExtractionService?: RfqExtractionService,
  ) {}

  onModuleInit(): void {
    // Register built-in handlers
    this.registerHandler("attachment_parse", async (payload) => {
      const rfqAttachmentId = payload["rfqAttachmentId"] as string;
      // Load attachment to get rfqIntakeId before parsing
      const attachment = await this.prisma.rfqAttachment.findUnique({
        where: { id: rfqAttachmentId },
        select: { rfqIntakeId: true },
      });
      await this.attachmentService.parseAttachment(rfqAttachmentId);
      // After parse (success or failure), try to aggregate and trigger extraction
      if (attachment) {
        const aggregated = await this.attachmentService.aggregateAttachmentContent(attachment.rfqIntakeId);
        if (aggregated) {
          // All attachments settled — find the RFQ and enqueue rfq_extract
          const rfq = await this.prisma.rfq.findFirst({
            where: { intake: { id: attachment.rfqIntakeId } },
            select: { id: true },
          });
          if (rfq) {
            await this.enqueue("rfq_extract", { rfqId: rfq.id });
          }
        }
      }
    });

    if (this.itemMatchingService) {
      this.registerHandler("item_match", async (payload) => {
        const rfqId = payload["rfqId"] as string;
        await this.itemMatchingService!.matchItemsForRfq(rfqId);
      });
    }

    if (this.sheetExportService) {
      this.registerHandler("sheet_export", async (payload) => {
        const quoteId = payload["quoteId"] as string;
        await this.sheetExportService!.exportQuote(quoteId);
      });
    }

    if (this.rfqExtractionService) {
      this.registerHandler("rfq_extract", async (payload) => {
        const rfqId = payload["rfqId"] as string;
        await this.rfqExtractionService!.extractAsync(rfqId);
      });
    }
  }

  registerHandler(type: JobType, handler: (payload: Record<string, unknown>) => Promise<void>): void {
    this.handlers.set(type, handler);
  }

  async enqueue(type: JobType, payload: Record<string, unknown>, maxAttempts = 3): Promise<void> {
    await this.prisma.backgroundJob.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        maxAttempts,
      },
    });
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processPendingJobs(): Promise<void> {
    const now = new Date();

    // Recover stale "running" jobs (process crashed mid-job more than 5 minutes ago)
    const staleThreshold = new Date(now.getTime() - 5 * 60 * 1000);
    await this.prisma.backgroundJob.updateMany({
      where: {
        status: "running",
        updatedAt: { lt: staleThreshold },
      },
      data: { status: "pending" },
    });

    const jobs = await this.prisma.backgroundJob.findMany({
      where: {
        status: "pending",
        OR: [
          { nextRunAt: null },
          { nextRunAt: { lte: now } },
        ],
      },
      take: 20,
      orderBy: { createdAt: "asc" },
    });

    // Filter jobs where attempts < maxAttempts
    const eligible = jobs.filter((j) => j.attempts < j.maxAttempts);

    for (const job of eligible) {
      // Mark as running
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "running", attempts: job.attempts + 1 },
      });

      const handler = this.handlers.get(job.type as JobType);
      if (!handler) {
        this.logger.warn(`No handler registered for job type: ${job.type}`);
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: "failed", errorMessage: `No handler for type: ${job.type}` },
        });
        continue;
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(job.payload) as Record<string, unknown>;
      } catch {
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: "failed", errorMessage: "Invalid JSON payload" },
        });
        continue;
      }

      try {
        await handler(payload);
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: "done" },
        });
        // Audit: job completed
        this.auditService?.log({
          actorId: null,
          action: "completed",
          resourceType: "background_job",
          resourceId: job.id,
          after: { type: job.type, attempts: job.attempts + 1 },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error(`Job ${job.id} (${job.type}) failed: ${errorMessage}`);
        const newAttempts = job.attempts + 1;
        const shouldRetry = newAttempts < job.maxAttempts;

        let nextRunAt: Date | undefined;
        if (shouldRetry) {
          // Exponential backoff: min(5000 * 2^(attempts) + jitter(0..1000), 300000)
          const backoffMs = Math.min(5000 * Math.pow(2, newAttempts - 1) + Math.floor(Math.random() * 1000), 300000);
          nextRunAt = new Date(Date.now() + backoffMs);
        }

        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: shouldRetry ? "pending" : "failed",
            errorMessage,
            ...(nextRunAt ? { nextRunAt } : {}),
          },
        });

        // Audit: job failed (max attempts reached)
        if (!shouldRetry) {
          this.auditService?.log({
            actorId: null,
            action: "failed",
            resourceType: "background_job",
            resourceId: job.id,
            after: { type: job.type, attempts: newAttempts, error: errorMessage },
          });
        }
      }
    }
  }

  serializeJob(job: {
    id: string;
    type: string;
    status: string;
    payload: string;
    attempts: number;
    maxAttempts: number;
    errorMessage: string | null;
    nextRunAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      payload: job.payload,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorMessage: job.errorMessage,
      nextRunAt: job.nextRunAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
