import { beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";

import { SmartEmailGenerationService } from "./smart-email-generation.service";
import { LlmService } from "../llm/llm.service";

const mockLlmService = {
  completeJson: vi.fn(),
};

async function buildService() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SmartEmailGenerationService,
      { provide: LlmService, useValue: mockLlmService },
    ],
  }).compile();

  return moduleRef.get(SmartEmailGenerationService);
}

const sampleQuote = {
  customerName: "John Doe",
  customerCompany: "Acme Corp",
  lineItems: [{ description: "Bolt", quantity: 10 }],
};

const sampleIntake = {
  subject: "Request for quote on bolts",
  body: "Please send us a quote for 10 bolts.",
};

describe("SmartEmailGenerationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSubject", () => {
    it("returns null when LlmService throws", async () => {
      mockLlmService.completeJson.mockRejectedValue(new Error("LLM timeout"));
      const service = await buildService();
      const result = await service.generateSubject(sampleQuote, sampleIntake);
      expect(result).toBeNull();
    });

    it("truncates subject to 80 chars when LLM returns a longer string", async () => {
      const longSubject = "A".repeat(100);
      mockLlmService.completeJson.mockResolvedValue({ subject: longSubject });
      const service = await buildService();
      const result = await service.generateSubject(sampleQuote, sampleIntake);
      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThanOrEqual(80);
    });

    it("returns the subject when LLM returns a valid short string", async () => {
      mockLlmService.completeJson.mockResolvedValue({ subject: "Quote for Bolts – Acme Corp" });
      const service = await buildService();
      const result = await service.generateSubject(sampleQuote, sampleIntake);
      expect(result).toBe("Quote for Bolts – Acme Corp");
    });

    it("returns null when LLM returns null subject", async () => {
      mockLlmService.completeJson.mockResolvedValue({ subject: null });
      const service = await buildService();
      const result = await service.generateSubject(sampleQuote, sampleIntake);
      expect(result).toBeNull();
    });
  });

  describe("generateBodyIntro", () => {
    it("returns null when LlmService throws", async () => {
      mockLlmService.completeJson.mockRejectedValue(new Error("API error"));
      const service = await buildService();
      const result = await service.generateBodyIntro(sampleQuote, sampleIntake);
      expect(result).toBeNull();
    });

    it("returns the intro when LLM returns a valid string", async () => {
      const intro = "Thank you for your inquiry. We are pleased to provide this quote.";
      mockLlmService.completeJson.mockResolvedValue({ intro });
      const service = await buildService();
      const result = await service.generateBodyIntro(sampleQuote, sampleIntake);
      expect(result).toBe(intro);
    });
  });
});
