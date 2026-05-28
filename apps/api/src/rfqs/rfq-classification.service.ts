import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ClassificationResult } from "@auto8/shared";

import { LlmService } from "../llm/llm.service";

const PASS_THROUGH: ClassificationResult = { isRfq: true, score: 1.0, reason: "classification_disabled" };

@Injectable()
export class RfqClassificationService {
  private readonly logger = new Logger(RfqClassificationService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly configService: ConfigService,
  ) {}

  async classify(subject: string, body: string): Promise<ClassificationResult> {
    if (!await this.llmService.isConfigured()) {
      return PASS_THROUGH;
    }

    try {
      const threshold = this.configService.get<number>("RFQ_CLASSIFICATION_THRESHOLD") ?? 0.7;

      const systemPrompt = `You are an email classifier for a procurement system. Determine whether the given message is a Request for Quotation (RFQ) or not.
Return a JSON object with exactly these fields:
- isRfq: boolean (true if this is an RFQ, false otherwise)
- score: number between 0 and 1 (confidence that this IS an RFQ; 1.0 = definitely an RFQ)
- reason: string (brief reason for classification, e.g. "contains part numbers and quantity requests")`;

      const userPrompt = `Subject: ${subject}\n\nBody:\n${body}`;

      const result = await this.llmService.completeJson(systemPrompt, userPrompt);

      if (!result || typeof result !== "object") {
        this.logger.warn("LLM returned unexpected classification result");
        return { isRfq: true, score: 1.0, reason: "classification_error" };
      }

      const raw = result as Record<string, unknown>;
      const score = typeof raw["score"] === "number" ? raw["score"] : 1.0;
      const reason = typeof raw["reason"] === "string" ? raw["reason"] : "unknown";
      const isRfq = score >= threshold;

      return { isRfq, score, reason };
    } catch (err) {
      this.logger.error("Classification failed", err);
      return { isRfq: true, score: 1.0, reason: "classification_error" };
    }
  }
}
