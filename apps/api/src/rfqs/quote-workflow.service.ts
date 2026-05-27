import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { QuoteStatus, type Prisma } from "@prisma/client";

import type { GenerateQuoteResult, QuoteLineItemInput, RfqDetailView, SaveQuoteInput } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";
import { RfqIntakeService } from "./rfq-intake.service";
import { QuoteEmailService } from "../quote-email/quote-email.service";
import { AuditService } from "../audit/audit.service";
import { AiQuoteGenerationService } from "./ai-quote-generation.service";
import { JobsService } from "../jobs/jobs.service";

@Injectable()
export class QuoteWorkflowService {
  private readonly logger = new Logger(QuoteWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rfqIntakeService: RfqIntakeService,
    private readonly quoteEmailService: QuoteEmailService,
    private readonly auditService: AuditService,
    private readonly aiQuoteGenerationService: AiQuoteGenerationService,
    @Optional() private readonly jobsService?: JobsService,
  ) {}

  async saveDraft(rfqId: string, input: SaveQuoteInput, actorId: string): Promise<RfqDetailView> {
    this.validateQuoteInput(input);

    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { quote: true },
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
            createdById: actorId,
            ...(input.discount !== undefined && { discount: input.discount }),
            ...(input.tax !== undefined && { tax: input.tax }),
            ...(input.grandTotal !== undefined && { grandTotal: input.grandTotal }),
            ...(input.paymentTerms && { paymentTerms: input.paymentTerms }),
            ...(input.deliveryTerms && { deliveryTerms: input.deliveryTerms }),
            ...(input.validityDays !== undefined && { validityDays: input.validityDays }),
            lineItems: {
              create: input.lineItems.map((item, index) => this.serializeLineItemCreate(item, index)),
            },
          },
        });

        await this.recordStatusEvent(tx, quote.id, QuoteStatus.draft, actorId);
        await this.updateWorkflowState(tx, rfqId, "draft");
      });

      // Advance pipeline status to 'quote_draft_created'
      this.rfqIntakeService.updatePipelineStatus(rfqId, "quote_draft_created").catch((err: unknown) =>
        this.logger.error("Failed to update pipeline status to quote_draft_created", err),
      );
    } else {
      const existingQuoteId = rfq.quote.id;

      await this.prisma.$transaction(async (tx) => {
        await tx.quote.update({
          where: { id: existingQuoteId },
          data: {
            customerName: input.customerName.trim(),
            customerCompany: input.customerCompany.trim(),
            notes: this.optionalString(input.notes),
            ...(input.discount !== undefined && { discount: input.discount }),
            ...(input.tax !== undefined && { tax: input.tax }),
            ...(input.grandTotal !== undefined && { grandTotal: input.grandTotal }),
            ...(input.paymentTerms !== undefined && { paymentTerms: input.paymentTerms }),
            ...(input.deliveryTerms !== undefined && { deliveryTerms: input.deliveryTerms }),
            ...(input.validityDays !== undefined && { validityDays: input.validityDays }),
            lineItems: {
              deleteMany: {},
              create: input.lineItems.map((item, index) => this.serializeLineItemCreate(item, index)),
            },
          },
        });

        await this.updateWorkflowState(tx, rfqId, "draft");
      });
    }

    const detail = await this.rfqIntakeService.getRfqDetail(rfqId);
    this.auditService.log({ actorId, action: 'quote.save_draft', resourceType: 'quote', resourceId: rfq.quote?.id ?? rfqId, after: { rfqId } });
    return detail;
  }

  async generateFromRfq(rfqId: string, actorId: string): Promise<GenerateQuoteResult> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { quote: true },
    });

    if (!rfq) {
      throw new NotFoundException("RFQ not found.");
    }

    if (rfq.quote?.status === QuoteStatus.pending_approval || rfq.quote?.status === QuoteStatus.approved) {
      throw new ConflictException("Quote has already been submitted or approved and cannot be regenerated.");
    }

    const input = await this.aiQuoteGenerationService.generate(rfqId);
    await this.saveDraft(rfqId, input, actorId);

    const detail = await this.rfqIntakeService.getRfqDetail(rfqId);
    const quote = detail.quote!;

    return {
      quote,
      isAiGenerated: true,
      model: await this.aiQuoteGenerationService.getModel(),
    };
  }

  async submitForApproval(quoteId: string, actorId: string): Promise<RfqDetailView> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { lineItems: true },
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
          submittedAt: new Date(),
        },
      });

      await this.recordStatusEvent(tx, quoteId, QuoteStatus.pending_approval, actorId);
      await this.updateWorkflowState(tx, quote.rfqId, "pending_approval");
    });

    const detail = await this.rfqIntakeService.getRfqDetail(quote.rfqId);
    this.auditService.log({ actorId, action: 'quote.submit', resourceType: 'quote', resourceId: quoteId });
    return detail;
  }

  async approveQuote(quoteId: string, actorId: string, autoSend = false): Promise<RfqDetailView> {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });

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
          approvedById: actorId,
        },
      });

      await this.recordStatusEvent(tx, quoteId, QuoteStatus.approved, actorId);
      await this.updateWorkflowState(tx, quote.rfqId, "approved");
    });

    // Generate email draft after approval; failure does not roll back approval
    try {
      await this.quoteEmailService.generateDraft(quoteId, autoSend);
    } catch (err) {
      this.logger.error(`Failed to generate quote email draft for quoteId=${quoteId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Enqueue sheet export job if configured
    if (this.jobsService) {
      this.jobsService.enqueue("sheet_export", { quoteId }).catch((err: unknown) =>
        this.logger.error("Failed to enqueue sheet_export job", err),
      );
    }

    // Advance pipeline status to 'approved'
    this.rfqIntakeService.updatePipelineStatus(quote.rfqId, "approved").catch((err: unknown) =>
      this.logger.error("Failed to update pipeline status to approved", err),
    );

    this.auditService.log({ actorId, action: 'quote.approve', resourceType: 'quote', resourceId: quoteId, after: { status: 'approved' } });
    return this.rfqIntakeService.getRfqDetail(quote.rfqId);
  }

  private async updateWorkflowState(
    tx: Prisma.TransactionClient,
    rfqId: string,
    state: "new" | "draft" | "pending_approval" | "approved"
  ) {
    return tx.rfq.update({ where: { id: rfqId }, data: { workflowState: state } });
  }

  private async recordStatusEvent(
    tx: Prisma.TransactionClient,
    quoteId: string,
    status: QuoteStatus,
    actorId?: string
  ) {
    return tx.quoteStatusEvent.create({ data: { quoteId, actorId, status } });
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
      sortOrder: index,
      ...(item.discount !== undefined && { discount: item.discount }),
      ...(item.productId !== undefined && { productId: item.productId }),
    };
  }

  async createQuoteFromMatches(rfqId: string, actorId: string): Promise<RfqDetailView> {
    // Load accepted/overridden matches for this RFQ
    const extractedItems = await this.prisma.rfqExtractedItem.findMany({
      where: { rfqId },
      include: {
        matches: {
          where: { status: { in: ["accepted", "overridden"] } },
          include: { product: true },
          orderBy: { score: "desc" },
          take: 1,
        },
      },
    });

    const acceptedMatches = extractedItems
      .filter((item) => item.matches.length > 0)
      .map((item) => {
        const match = item.matches[0]!;
        const description = match.overrideDescription ?? item.description;
        const unitPrice = match.overrideUnitPrice ?? match.product?.basePrice ?? 0;
        const productId = match.product?.id ?? undefined;
        return {
          description,
          quantity: item.quantity ?? 1,
          unitPrice: Math.round(unitPrice * 100), // convert to cents
          productId,
        };
      });

    if (acceptedMatches.length === 0) {
      throw new ConflictException("No accepted or overridden matches found for this RFQ. Accept at least one match before creating a quote.");
    }

    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { intake: true },
    });
    if (!rfq) throw new NotFoundException("RFQ not found.");

    const input: SaveQuoteInput = {
      customerName: rfq.intake.senderName ?? "Customer",
      customerCompany: rfq.intake.senderEmail ?? "Unknown",
      lineItems: acceptedMatches,
    };

    return this.saveDraft(rfqId, input, actorId);
  }

  private optionalString(value: string | null | undefined) {
    return value?.trim() || null;
  }
}
