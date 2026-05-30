import { forwardRef, Inject, Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AttachmentService } from "../attachments/attachment.service";
import { ItemMatchingService } from "../matching/item-matching.service";
import { SheetExportService } from "../sheet-export/sheet-export.service";
import { AuditService } from "../audit/audit.service";
import { RfqExtractionService } from "../rfqs/rfq-extraction.service";
import { LlmService } from "../llm/llm.service";

export type JobType = "attachment_parse" | "item_match" | "sheet_export" | "rfq_extract" | "generate_embeddings" | "catalogue_enrichment" | "webhook_deliver";

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
    @Optional() private readonly llmService?: LlmService,
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

    if (this.llmService) {
      this.registerHandler("generate_embeddings", async (payload) => {
        const catalogueId = payload["catalogueId"] as string | undefined;
        const where = catalogueId ? { catalogueId } : {};
        const products = await this.prisma.product.findMany({
          where: { ...where, isActive: true },
          select: { id: true, productName: true, productCode: true, description: true },
          take: 100,
        });
        for (const product of products) {
          const text = [product.productName, product.productCode, product.description ?? ""].join(" ");
          const embedding = await this.llmService!.embedText(text);
          if (!embedding) continue;
          const vectorLiteral = `[${embedding.join(",")}]`;
          await this.prisma.$executeRaw`
            UPDATE "public"."Product" SET embedding = ${vectorLiteral}::vector WHERE id = ${product.id}
          `;
          await new Promise((r) => setTimeout(r, 500));
        }
      });

      this.registerHandler("catalogue_enrichment", async (payload) => {
        const catalogueId = payload["catalogueId"] as string;
        const products = await this.prisma.product.findMany({
          where: { catalogueId, isActive: true },
          select: { id: true, productCode: true, productName: true, description: true, brand: true },
          take: 50,
        });
        for (const product of products) {
          const result = await this.llmService!.completeJson(
            "You are a product catalogue enrichment assistant. Given a product, return a JSON object with: categoryTags (array of 1-5 relevant category tags), improvedDescription (string, max 200 chars, or null if already good), brand (string or null if unknown).",
            `Product: ${product.productName}\nCode: ${product.productCode}\nDescription: ${product.description ?? "N/A"}\nBrand: ${product.brand ?? "N/A"}`
          ) as { categoryTags?: string[]; improvedDescription?: string | null; brand?: string | null } | null;

          if (!result) continue;

          await this.prisma.catalogueEnrichmentSuggestion.create({
            data: {
              catalogueId,
              productCode: product.productCode,
              suggestions: result as unknown as Prisma.InputJsonValue,
              status: "pending",
            },
          });
          await new Promise((r) => setTimeout(r, 200));
        }
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
