import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { QuoteStatus, type Prisma } from "@prisma/client";

import type { AssignRfqInput, GenerateQuoteResult, QuoteDiffResult, QuoteLineItemInput, RfqDetailView, ReviseQuoteResult, SaveQuoteInput } from "@auto8/shared";
import { calcQuoteTotals } from "@auto8/shared";

import { optionalString } from "../common/utils/string.util";
import { PrismaService } from "../prisma/prisma.service";
import { RfqIntakeService } from "./rfq-intake.service";
import { QuoteEmailService } from "../quote-email/quote-email.service";
import { AuditService } from "../audit/audit.service";
import { AiQuoteGenerationService } from "./ai-quote-generation.service";
import { JobsService } from "../jobs/jobs.service";

@Injectable()
export class QuoteWorkflowService {
  private readonly logger = new Logger(QuoteWorkflowService.name);

  webhookEmitter?: { emit(event: string, payload: Record<string, unknown>): Promise<void> };

  constructor(
    private readonly prisma: PrismaService,
    private readonly rfqIntakeService: RfqIntakeService,
    private readonly quoteEmailService: QuoteEmailService,
    private readonly auditService: AuditService,
    private readonly aiQuoteGenerationService: AiQuoteGenerationService,
    private readonly jobsService: JobsService,
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

    let resolvedInput = input;
    if (input.templateId) {
      const template = await (this.prisma as unknown as { quoteTemplate: { findUnique: (args: unknown) => Promise<{ paymentTerms: string | null; deliveryTerms: string | null; validityDays: number | null; currency: string; headerNotes: string | null; lineItems: Array<{ description: string; quantity: number; unitPrice: number; sortOrder: number; productId: string | null }> } | null> } }).quoteTemplate.findUnique({
        where: { id: input.templateId },
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
      });
      if (template) {
        resolvedInput = {
          ...input,
          paymentTerms: input.paymentTerms ?? template.paymentTerms ?? undefined,
          deliveryTerms: input.deliveryTerms ?? template.deliveryTerms ?? undefined,
          validityDays: input.validityDays ?? template.validityDays ?? undefined,
          currency: input.currency ?? template.currency,
          notes: input.notes ?? template.headerNotes ?? undefined,
          lineItems: input.lineItems.length > 0
            ? input.lineItems
            : template.lineItems.map((li) => ({
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                productId: li.productId ?? undefined,
              })),
        };
      }
    }

    if (resolvedInput.customerId) {
      const customer = await (this.prisma as unknown as { customer: { findUnique: (args: unknown) => Promise<{ id: string } | null> } }).customer.findUnique({
        where: { id: resolvedInput.customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundException(`Customer ${resolvedInput.customerId} not found.`);
      }
    }

    if (!rfq.quote) {
      await this.prisma.$transaction(async (tx) => {
        const lineItemsData = resolvedInput.lineItems.map((item, index) => this.serializeLineItemCreate(item, index));
        const computedGrandTotal = calcQuoteTotals(lineItemsData, resolvedInput.discount ?? 0, resolvedInput.tax ?? 0).grandTotal;

        const quote = await (tx as unknown as { quote: { create: (args: unknown) => Promise<{ id: string }> } }).quote.create({
          data: {
            rfqId,
            customerName: resolvedInput.customerName.trim(),
            customerCompany: resolvedInput.customerCompany.trim(),
            notes: optionalString(resolvedInput.notes),
            createdById: actorId,
            ...(resolvedInput.discount !== undefined && { discount: resolvedInput.discount }),
            ...(resolvedInput.tax !== undefined && { tax: resolvedInput.tax }),
            grandTotal: computedGrandTotal,
            ...(resolvedInput.currency && { currency: resolvedInput.currency }),
            ...(resolvedInput.exchangeRate !== undefined && { exchangeRate: resolvedInput.exchangeRate }),
            ...(resolvedInput.customerId && { customerId: resolvedInput.customerId }),
            ...(resolvedInput.paymentTerms && { paymentTerms: resolvedInput.paymentTerms }),
            ...(resolvedInput.deliveryTerms && { deliveryTerms: resolvedInput.deliveryTerms }),
            ...(resolvedInput.validityDays !== undefined && { validityDays: resolvedInput.validityDays }),
            lineItems: {
              create: lineItemsData,
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
        const lineItemsData = resolvedInput.lineItems.map((item, index) => this.serializeLineItemCreate(item, index));
        const computedGrandTotal = calcQuoteTotals(lineItemsData, resolvedInput.discount ?? 0, resolvedInput.tax ?? 0).grandTotal;

        await (tx as unknown as { quote: { update: (args: unknown) => Promise<unknown> } }).quote.update({
          where: { id: existingQuoteId },
          data: {
            customerName: resolvedInput.customerName.trim(),
            customerCompany: resolvedInput.customerCompany.trim(),
            notes: optionalString(resolvedInput.notes),
            ...(resolvedInput.discount !== undefined && { discount: resolvedInput.discount }),
            ...(resolvedInput.tax !== undefined && { tax: resolvedInput.tax }),
            grandTotal: computedGrandTotal,
            ...(resolvedInput.currency && { currency: resolvedInput.currency }),
            ...(resolvedInput.exchangeRate !== undefined && { exchangeRate: resolvedInput.exchangeRate }),
            ...(resolvedInput.customerId !== undefined && { customerId: resolvedInput.customerId }),
            ...(resolvedInput.paymentTerms !== undefined && { paymentTerms: resolvedInput.paymentTerms }),
            ...(resolvedInput.deliveryTerms !== undefined && { deliveryTerms: resolvedInput.deliveryTerms }),
            ...(resolvedInput.validityDays !== undefined && { validityDays: resolvedInput.validityDays }),
            lineItems: {
              deleteMany: {},
              create: lineItemsData,
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
    // Advance pipeline status to quote_submitted
    this.rfqIntakeService.updatePipelineStatus(quote.rfqId, "quote_submitted").catch((err: unknown) =>
      this.logger.error("Failed to update pipeline status to quote_submitted", err),
    );
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

    // Enqueue sheet export job
    this.jobsService.enqueue("sheet_export", { quoteId }).catch((err: unknown) =>
      this.logger.error("Failed to enqueue sheet_export job", err),
    );

    // Advance pipeline status to 'approved'
    this.rfqIntakeService.updatePipelineStatus(quote.rfqId, "approved").catch((err: unknown) =>
      this.logger.error("Failed to update pipeline status to approved", err),
    );

    this.auditService.log({ actorId, action: 'quote.approve', resourceType: 'quote', resourceId: quoteId, after: { status: 'approved' } });
    this.webhookEmitter?.emit("quote.approved", { quoteId, rfqId: quote.rfqId }).catch((err: unknown) =>
      this.logger.error("Failed to emit quote.approved webhook", err),
    );
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

    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      throw new BadRequestException(`Line item ${index + 1} requires a non-negative unit price.`);
    }
  }

  private serializeLineItemCreate(item: QuoteLineItemInput, index: number) {
    const subtotal = Math.round(item.unitPrice * item.quantity * (1 - (item.discount ?? 0) / 100) * 100) / 100;
    return {
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal,
      sortOrder: index,
      ...(item.discount !== undefined && { discount: item.discount }),
      ...(item.productId !== undefined && { productId: item.productId }),
    };
  }

  async createQuoteFromMatches(rfqId: string, actorId: string): Promise<RfqDetailView> {
    // Guard: prevent silently overwriting an existing manually-edited draft
    const existingRfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { quote: { select: { status: true } } },
    });
    if (existingRfq?.quote?.status === "draft") {
      throw new ConflictException("A draft quote already exists. Submit or delete it before creating from matches.");
    }

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
          unitPrice: Math.round(unitPrice * 100) / 100, // keep as dollars, round to 2dp
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

    // Use extracted customer data if available, fall back to sender email
    const extractedCustomer = await this.prisma.rfqExtractedCustomer.findUnique({ where: { rfqId } });

    const input: SaveQuoteInput = {
      customerName: extractedCustomer?.customerContact ?? rfq.intake.senderName ?? "Customer",
      customerCompany: extractedCustomer?.customerCompany ?? rfq.intake.senderEmail ?? "Unknown",
      lineItems: acceptedMatches,
    };

    return this.saveDraft(rfqId, input, actorId);
  }

  async reviseQuote(quoteId: string, actorId: string): Promise<ReviseQuoteResult> {
    const existing = await (this.prisma as unknown as { quote: { findUnique: (args: unknown) => Promise<{ id: string; rfqId: string; status: string; version: number; customerName: string; customerCompany: string; notes: string | null; discount: number; tax: number; currency: string; exchangeRate: number; paymentTerms: string | null; deliveryTerms: string | null; validityDays: number | null; customerId: string | null; lineItems: Array<{ description: string; quantity: number; unitPrice: number; discount: number; sortOrder: number; productId: string | null }> } | null> } }).quote.findUnique({
      where: { id: quoteId },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });

    if (!existing) throw new NotFoundException("Quote not found.");
    if (existing.status !== QuoteStatus.approved) {
      throw new ConflictException("Only approved quotes can be revised.");
    }

    const newVersion = existing.version + 1;
    const revisedStatus = "revised" as unknown as QuoteStatus;
    const newQuote = await this.prisma.$transaction(async (tx) => {
      await (tx as unknown as { quote: { update: (args: unknown) => Promise<unknown> } }).quote.update({
        where: { id: quoteId },
        data: { status: revisedStatus },
      });

      await (tx as unknown as { quoteStatusEvent: { create: (args: unknown) => Promise<unknown> } }).quoteStatusEvent.create({
        data: { quoteId, status: revisedStatus, actorId },
      });

      const created = await (tx as unknown as { quote: { create: (args: unknown) => Promise<{ id: string }> } }).quote.create({
        data: {
          rfqId: existing.rfqId,
          customerName: existing.customerName,
          customerCompany: existing.customerCompany,
          notes: existing.notes,
          discount: existing.discount,
          tax: existing.tax,
          currency: existing.currency,
          exchangeRate: existing.exchangeRate,
          paymentTerms: existing.paymentTerms,
          deliveryTerms: existing.deliveryTerms,
          validityDays: existing.validityDays,
          customerId: existing.customerId,
          createdById: actorId,
          version: newVersion,
          parentQuoteId: quoteId,
          lineItems: {
            create: existing.lineItems.map((li) => ({
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              discount: li.discount,
              sortOrder: li.sortOrder,
              productId: li.productId,
              subtotal: Math.round(li.unitPrice * li.quantity * (1 - li.discount / 100) * 100) / 100,
            })),
          },
        },
      });

      await (tx as unknown as { quoteStatusEvent: { create: (args: unknown) => Promise<unknown> } }).quoteStatusEvent.create({
        data: { quoteId: created.id, status: QuoteStatus.draft, actorId },
      });

      // Reset rfq workflow state to draft
      await tx.rfq.update({ where: { id: existing.rfqId }, data: { workflowState: "draft" } });

      return created;
    });

    this.auditService.log({ actorId, action: 'quote.revise', resourceType: 'quote', resourceId: quoteId, after: { newQuoteId: newQuote.id, version: newVersion } });
    return { newQuoteId: newQuote.id, version: newVersion, rfqId: existing.rfqId };
  }

  async getRevisions(quoteId: string): Promise<Array<{ id: string; version: number; status: string; createdAt: string; parentQuoteId: string | null }>> {
    // Find root quote by traversing parent chain
    let rootId = quoteId;
    type QuoteChain = { id: string; parentQuoteId: string | null };
    const findRoot = async (id: string): Promise<string> => {
      const q = await (this.prisma as unknown as { quote: { findUnique: (args: unknown) => Promise<QuoteChain | null> } }).quote.findUnique({ where: { id }, select: { id: true, parentQuoteId: true } });
      if (!q) return id;
      if (q.parentQuoteId) return findRoot(q.parentQuoteId);
      return q.id;
    };
    rootId = await findRoot(quoteId);

    // Get all quotes in the chain starting from root
    const collectChain = async (id: string): Promise<Array<{ id: string; version: number; status: string; createdAt: Date; parentQuoteId: string | null }>> => {
      const q = await (this.prisma as unknown as { quote: { findUnique: (args: unknown) => Promise<{ id: string; version: number; status: string; createdAt: Date; parentQuoteId: string | null; revisions: Array<{ id: string }> } | null> } }).quote.findUnique({
        where: { id },
        select: { id: true, version: true, status: true, createdAt: true, parentQuoteId: true, revisions: { select: { id: true } } },
      });
      if (!q) return [];
      const children = await Promise.all(q.revisions.map((r) => collectChain(r.id)));
      return [{ id: q.id, version: q.version, status: q.status, createdAt: q.createdAt, parentQuoteId: q.parentQuoteId }, ...children.flat()];
    };

    const chain = await collectChain(rootId);
    return chain
      .sort((a, b) => a.version - b.version)
      .map((q) => ({ id: q.id, version: q.version, status: q.status, createdAt: q.createdAt.toISOString(), parentQuoteId: q.parentQuoteId }));
  }

  async getQuoteDiff(quoteId: string): Promise<QuoteDiffResult> {
    type QuoteWithItems = { id: string; version: number; parentQuoteId: string | null; customerName: string; customerCompany: string; notes: string | null; discount: number; tax: number; currency: string; exchangeRate: number; paymentTerms: string | null; deliveryTerms: string | null; validityDays: number | null; lineItems: Array<{ description: string; quantity: number; unitPrice: number }> };
    const quote = await (this.prisma as unknown as { quote: { findUnique: (args: unknown) => Promise<QuoteWithItems | null> } }).quote.findUnique({
      where: { id: quoteId },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!quote) throw new NotFoundException("Quote not found.");
    if (!quote.parentQuoteId) return { quoteId, parentQuoteId: '', version: quote.version, diffs: [] };

    const parent = await (this.prisma as unknown as { quote: { findUnique: (args: unknown) => Promise<QuoteWithItems | null> } }).quote.findUnique({
      where: { id: quote.parentQuoteId },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!parent) return { quoteId, parentQuoteId: quote.parentQuoteId, version: quote.version, diffs: [] };

    const scalarFields: Array<keyof Omit<QuoteWithItems, 'id' | 'version' | 'parentQuoteId' | 'lineItems'>> = [
      'customerName', 'customerCompany', 'notes', 'discount', 'tax', 'currency', 'exchangeRate', 'paymentTerms', 'deliveryTerms', 'validityDays',
    ];
    const diffs: Array<{ field: string; before: unknown; after: unknown }> = scalarFields
      .filter((f) => parent[f] !== quote[f])
      .map((f) => ({ field: f as string, before: parent[f] as unknown, after: quote[f] as unknown }));

    if (JSON.stringify(parent.lineItems) !== JSON.stringify(quote.lineItems)) {
      diffs.push({ field: 'lineItems', before: parent.lineItems as unknown, after: quote.lineItems as unknown });
    }

    return { quoteId, parentQuoteId: quote.parentQuoteId, version: quote.version, diffs };
  }

  async assignRfq(rfqId: string, input: AssignRfqInput): Promise<{ ok: boolean }> {
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId }, select: { id: true } });
    if (!rfq) throw new NotFoundException("RFQ not found.");

    if (input.assignedToId !== null) {
      const user = await this.prisma.user.findUnique({ where: { id: input.assignedToId }, select: { id: true } });
      if (!user) throw new NotFoundException("User not found.");
    }

    await (this.prisma as unknown as { rfq: { update: (args: unknown) => Promise<unknown> } }).rfq.update({
      where: { id: rfqId },
      data: { assignedToId: input.assignedToId },
    });

    return { ok: true };
  }
}
