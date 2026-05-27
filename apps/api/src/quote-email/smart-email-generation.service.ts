import { Injectable, Logger } from "@nestjs/common";
import { LlmService } from "../llm/llm.service";

@Injectable()
export class SmartEmailGenerationService {
  private readonly logger = new Logger(SmartEmailGenerationService.name);

  constructor(private readonly llmService: LlmService) {}

  async generateSubject(
    quote: {
      customerName: string;
      customerCompany: string;
      lineItems: Array<{ description: string; quantity: number }>;
    },
    rfqIntake: { subject: string; body: string }
  ): Promise<string | null> {
    try {
      const lineItemsSummary = quote.lineItems
        .map((item) => `- ${item.description} (qty: ${item.quantity})`)
        .join("\n");

      const system = `You are a professional email subject line writer. Generate a concise, context-aware email subject for a quote response.
The subject MUST be 80 characters or fewer. Do not include quotes or special formatting. Return a JSON object with a single field "subject".`;

      const user = `Customer: ${quote.customerName} at ${quote.customerCompany}
Original RFQ subject: ${rfqIntake.subject}
RFQ body (first 500 chars): ${rfqIntake.body.slice(0, 500)}
Quote line items:
${lineItemsSummary}

Generate an email subject for this quote response.`;

      const result = await this.llmService.completeJson(system, user) as { subject?: string } | null;
      const subject = result?.subject;

      if (!subject || typeof subject !== "string") return null;

      const trimmed = subject.trim().slice(0, 80);
      return trimmed.length > 0 ? trimmed : null;
    } catch (err) {
      this.logger.error(`Failed to generate email subject: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async generateBodyIntro(
    quote: {
      customerName: string;
      customerCompany: string;
      lineItems: Array<{ description: string; quantity: number }>;
    },
    rfqIntake: { subject: string; body: string }
  ): Promise<string | null> {
    try {
      const lineItemsSummary = quote.lineItems
        .map((item) => `- ${item.description} (qty: ${item.quantity})`)
        .join("\n");

      const system = `You are a professional business email writer. Write a warm, concise opening paragraph (2-3 sentences) for a quote response email.
Do not include line items or pricing — those will be added separately. Return a JSON object with a single field "intro".`;

      const user = `Customer: ${quote.customerName} at ${quote.customerCompany}
Original RFQ subject: ${rfqIntake.subject}
RFQ body (first 500 chars): ${rfqIntake.body.slice(0, 500)}
Quote line items:
${lineItemsSummary}

Write an opening paragraph for this quote response email.`;

      const result = await this.llmService.completeJson(system, user) as { intro?: string } | null;
      const intro = result?.intro;

      if (!intro || typeof intro !== "string") return null;
      return intro.trim() || null;
    } catch (err) {
      this.logger.error(`Failed to generate email body intro: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
