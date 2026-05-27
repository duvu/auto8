import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { SaveQuoteInput } from "@auto8/shared";

import { LlmService } from "../llm/llm.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AiQuoteGenerationService {
  constructor(
    private readonly llmService: LlmService,
    private readonly prisma: PrismaService,
  ) {}

  getModel(): Promise<string> {
    return this.llmService.getModel();
  }

  async generate(rfqId: string): Promise<SaveQuoteInput> {
    if (!await this.llmService.isConfigured()) {
      throw new ServiceUnavailableException(
        "AI quote generation is not available — LLM provider is not configured."
      );
    }

    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: {
        intake: true,
        extractedItems: true,
      },
    });

    if (!rfq) {
      throw new ServiceUnavailableException("RFQ not found for AI quote generation.");
    }

    const systemPrompt = `You are a procurement quoting assistant. Given an inbound RFQ (Request for Quotation) message, generate a draft quote in JSON format.

Return a JSON object matching this exact structure:
{
  "customerName": string,        // full name of the requester (from email signature or sender name)
  "customerCompany": string,     // company name of the requester
  "notes": string | null,        // optional free-text notes for the operator
  "lineItems": [
    {
      "description": string,     // item description
      "quantity": number,        // positive integer quantity
      "unitPrice": number | null // unit price in cents (integer), or null if not inferable from RFQ
    }
  ]
}

Rules:
- Extract line items from the RFQ content. Use the pre-parsed extracted items if provided, otherwise parse from the body.
- Set unitPrice to null unless a price is explicitly stated in the RFQ content.
- customerName should come from the sender name or email signature.
- customerCompany should come from the sender email domain or any company mentioned in the message.
- Provide at least one line item. If you cannot determine a specific item, create one placeholder from the subject.
- Return only valid JSON matching the structure above.`;

    const extractedItemsJson = rfq.extractedItems.length > 0
      ? `\n\nPre-parsed extracted items (structured context):\n${JSON.stringify(rfq.extractedItems.map(i => ({ partNumber: i.partNumber, description: i.description, quantity: i.quantity, unit: i.unit })), null, 2)}`
      : "";

    const userPrompt = `Subject: ${rfq.intake.subject}
Sender name: ${rfq.intake.senderName ?? "Unknown"}
Sender email: ${rfq.intake.senderEmail ?? "Unknown"}

Message body:
${rfq.intake.body}${extractedItemsJson}`;

    const result = await this.llmService.completeJson(systemPrompt, userPrompt);

    if (!result || typeof result !== "object") {
      throw new ServiceUnavailableException("AI quote generation returned an unexpected response.");
    }

    const raw = result as Record<string, unknown>;

    const customerName = typeof raw["customerName"] === "string" ? raw["customerName"] : "Unknown Customer";
    const customerCompany = typeof raw["customerCompany"] === "string" ? raw["customerCompany"] : "Unknown Company";
    const notes = typeof raw["notes"] === "string" ? raw["notes"] : undefined;

    const rawItems = Array.isArray(raw["lineItems"]) ? raw["lineItems"] : [];
    const lineItems = (rawItems as Array<Record<string, unknown>>).map((item) => ({
      description: typeof item["description"] === "string" ? item["description"] : "Item",
      quantity: typeof item["quantity"] === "number" && Number.isInteger(item["quantity"]) && item["quantity"] > 0
        ? item["quantity"]
        : 1,
      unitPrice: typeof item["unitPrice"] === "number" && Number.isInteger(item["unitPrice"]) && item["unitPrice"] >= 0
        ? item["unitPrice"]
        : 0,
    }));

    if (lineItems.length === 0) {
      lineItems.push({ description: rfq.intake.subject, quantity: 1, unitPrice: 0 });
    }

    return {
      customerName,
      customerCompany,
      notes,
      lineItems,
    };
  }
}
