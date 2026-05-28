import { Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import type { RfqExtractedCustomerView, RfqExtractedItemView } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "../llm/llm.service";
import { JobsService } from "../jobs/jobs.service";
import type { UpdateExtractedItemDto } from "./dto/update-extracted-item.dto";

interface ExtractedLineItem {
  partNumber?: string | null;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  confidence: number;
  confidenceReason?: string | null;
}

interface ExtractedCustomer {
  customerCompany?: string | null;
  customerContact?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  deliveryLocation?: string | null;
  requestedDeadline?: string | null;
  notes?: string | null;
}

@Injectable()
export class RfqExtractionService {
  private readonly logger = new Logger(RfqExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
    @Optional() private readonly jobsService?: JobsService,
  ) {}

  async extractAsync(rfqId: string): Promise<void> {
    try {
      const rfq = await this.prisma.rfq.findUnique({
        where: { id: rfqId },
        include: { intake: true },
      });

      if (!rfq) {
        this.logger.warn(`RFQ not found for extraction: ${rfqId}`);
        return;
      }

      // Guard: if any attachments are still pending parsing, defer extraction
      // The rfq_extract job will be re-enqueued after aggregateAttachmentContent settles
      const pendingAttachmentCount = await this.prisma.rfqAttachment.count({
        where: { rfqIntakeId: rfq.intakeId, parseStatus: "pending" },
      });
      if (pendingAttachmentCount > 0) {
        this.logger.debug(
          `Deferring extraction for RFQ ${rfqId} — ${pendingAttachmentCount} attachment(s) still pending`,
        );
        return;
      }

      // Build prompt — append attachment content if available
      let bodyContent = rfq.intake.body;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attachmentContent = (rfq.intake as any).attachmentContent as string | null | undefined;
      if (attachmentContent) {
        bodyContent += `\n\n[ATTACHMENTS]\n${attachmentContent}`;
      }

      const systemPrompt = `You are an RFQ (Request for Quotation) extraction assistant.
Extract all requested items AND customer information from the RFQ message and return them as a JSON object.

The JSON must have:
- "items": array of line items, each with:
  - partNumber: string or null (product/part code if mentioned)
  - description: string (required)
  - quantity: number or null
  - unit: string or null (e.g. "pcs", "kg", "m")
  - confidence: number between 0 and 1
  - confidenceReason: string or null (brief explanation of confidence score)
- "customer": object with:
  - customerCompany: string or null
  - customerContact: string or null (contact person name)
  - customerEmail: string or null
  - customerPhone: string or null
  - deliveryLocation: string or null
  - requestedDeadline: string or null (ISO date or descriptive)
  - notes: string or null (any other relevant customer requirements)

Return ONLY valid JSON like: {"items": [...], "customer": {...}}`;

      const userPrompt = `Subject: ${rfq.intake.subject}\n\nBody:\n${bodyContent}`;

      const result = await this.llmService.completeJson(systemPrompt, userPrompt);

      if (!result) {
        // LlmService is unconfigured or returned null — no-op
        return;
      }

      const parsed = result as { items?: unknown[]; customer?: unknown };

      // Parse and save line items
      const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
      const items: ExtractedLineItem[] = rawItems
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          partNumber: typeof item["partNumber"] === "string" ? item["partNumber"] : null,
          description: typeof item["description"] === "string" ? item["description"] : "",
          quantity: typeof item["quantity"] === "number" ? item["quantity"] : null,
          unit: typeof item["unit"] === "string" ? item["unit"] : null,
          confidence: typeof item["confidence"] === "number" ? item["confidence"] : 0,
          confidenceReason: typeof item["confidenceReason"] === "string" ? item["confidenceReason"] : null,
        }))
        .filter((item) => item.description.length > 0);

      // Parse customer data
      const rawCustomer = typeof parsed.customer === "object" && parsed.customer !== null
        ? (parsed.customer as Record<string, unknown>)
        : {};
      const customer: ExtractedCustomer = {
        customerCompany: typeof rawCustomer["customerCompany"] === "string" ? rawCustomer["customerCompany"] : null,
        customerContact: typeof rawCustomer["customerContact"] === "string" ? rawCustomer["customerContact"] : null,
        customerEmail: typeof rawCustomer["customerEmail"] === "string" ? rawCustomer["customerEmail"] : null,
        customerPhone: typeof rawCustomer["customerPhone"] === "string" ? rawCustomer["customerPhone"] : null,
        deliveryLocation: typeof rawCustomer["deliveryLocation"] === "string" ? rawCustomer["deliveryLocation"] : null,
        requestedDeadline: typeof rawCustomer["requestedDeadline"] === "string" ? rawCustomer["requestedDeadline"] : null,
        notes: typeof rawCustomer["notes"] === "string" ? rawCustomer["notes"] : null,
      };

      await this.prisma.$transaction(async (tx) => {
        await tx.rfqExtractedItem.deleteMany({ where: { rfqId } });
        if (items.length > 0) {
          await tx.rfqExtractedItem.createMany({
            data: items.map((item) => ({
              rfqId,
              partNumber: item.partNumber,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              confidence: item.confidence,
              confidenceReason: item.confidenceReason,
            })),
          });
        }

        // Upsert extracted customer info
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any).rfqExtractedCustomer.upsert({
          where: { rfqId },
          create: { rfqId, ...customer },
          update: customer,
        });
      });

      this.logger.log(`Extracted ${items.length} items for RFQ ${rfqId}`);

      // Advance pipeline status to ready_for_quote if currently classified
      if (items.length > 0) {
        const currentRfq = await this.prisma.rfq.findUnique({
          where: { id: rfqId },
          select: { intakeId: true },
        });
        if (currentRfq?.intakeId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const intake = await (this.prisma.rfqIntake as any).findUnique({
            where: { id: currentRfq.intakeId },
            select: { rfqPipelineStatus: true },
          });
          if (intake?.rfqPipelineStatus === "classified") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (this.prisma.rfqIntake as any).update({
              where: { id: currentRfq.intakeId },
              data: { rfqPipelineStatus: "ready_for_quote" },
            });
          }
        }
      }

      // Enqueue item matching job if items were extracted
      if (items.length > 0 && this.jobsService) {
        this.jobsService.enqueue("item_match", { rfqId }).catch((err: unknown) =>
          this.logger.error("Failed to enqueue item_match job", err),
        );
      }
    } catch (err) {
      this.logger.error(`Extraction failed for RFQ ${rfqId}`, err);
    }
  }

  async getExtractedItems(rfqId: string): Promise<RfqExtractedItemView[]> {
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw new NotFoundException("RFQ not found.");

    const items = await this.prisma.rfqExtractedItem.findMany({
      where: { rfqId },
      orderBy: { createdAt: "asc" },
    });

    return items.map((item) => ({
      id: item.id,
      rfqId: item.rfqId,
      partNumber: item.partNumber,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      confidence: item.confidence,
      confidenceReason: (item as { confidenceReason?: string | null }).confidenceReason ?? null,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async getExtractedCustomer(rfqId: string): Promise<RfqExtractedCustomerView | null> {
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw new NotFoundException("RFQ not found.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = await (this.prisma as any).rfqExtractedCustomer.findUnique({ where: { rfqId } });
    if (!customer) return null;

    return {
      id: customer.id as string,
      rfqId: customer.rfqId as string,
      customerCompany: customer.customerCompany as string | null,
      customerContact: customer.customerContact as string | null,
      customerEmail: customer.customerEmail as string | null,
      customerPhone: customer.customerPhone as string | null,
      deliveryLocation: customer.deliveryLocation as string | null,
      requestedDeadline: customer.requestedDeadline as string | null,
      notes: customer.notes as string | null,
      createdAt: (customer.createdAt as Date).toISOString(),
    };
  }

  async updateItem(rfqId: string, itemId: string, dto: UpdateExtractedItemDto): Promise<RfqExtractedItemView> {
    const item = await this.prisma.rfqExtractedItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Extracted item not found.");
    if (item.rfqId !== rfqId) throw new NotFoundException("Extracted item does not belong to this RFQ.");

    const updateData: Record<string, unknown> = {};
    if (dto.description !== undefined) updateData["description"] = dto.description;
    if (dto.partNumber !== undefined) updateData["partNumber"] = dto.partNumber;
    if (dto.quantity !== undefined) updateData["quantity"] = dto.quantity;
    if (dto.unit !== undefined) updateData["unit"] = dto.unit;

    const updated = await this.prisma.rfqExtractedItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return {
      id: updated.id,
      rfqId: updated.rfqId,
      partNumber: updated.partNumber,
      description: updated.description,
      quantity: updated.quantity,
      unit: updated.unit,
      confidence: updated.confidence,
      confidenceReason: (updated as { confidenceReason?: string | null }).confidenceReason ?? null,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
