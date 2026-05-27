import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AttachmentService } from "../attachments/attachment.service";
import { ItemMatchingService } from "../matching/item-matching.service";
import { SheetExportService } from "../sheet-export/sheet-export.service";

export type JobType = "attachment_parse" | "item_match" | "sheet_export";

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);
  private handlers: Map<JobType, (payload: Record<string, unknown>) => Promise<void>> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentService: AttachmentService,
    @Optional() private readonly itemMatchingService?: ItemMatchingService,
    @Optional() private readonly sheetExportService?: SheetExportService,
  ) {}

  onModuleInit(): void {
    // Register built-in handlers
    this.registerHandler("attachment_parse", async (payload) => {
      const rfqAttachmentId = payload["rfqAttachmentId"] as string;
      await this.attachmentService.parseAttachment(rfqAttachmentId);
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
    const jobs = await this.prisma.backgroundJob.findMany({
      where: {
        status: "pending",
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
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error(`Job ${job.id} (${job.type}) failed: ${errorMessage}`);
        const newAttempts = job.attempts + 1;
        const shouldRetry = newAttempts < job.maxAttempts;
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: shouldRetry ? "pending" : "failed",
            errorMessage,
          },
        });
      }
    }
  }
}
