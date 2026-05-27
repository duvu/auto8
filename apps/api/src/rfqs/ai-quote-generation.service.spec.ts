import { ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiQuoteGenerationService } from "./ai-quote-generation.service";
import { LlmService } from "../llm/llm.service";
import { PrismaService } from "../prisma/prisma.service";

const mockLlmService = {
  isConfigured: vi.fn(),
  getModel: vi.fn(),
  completeJson: vi.fn(),
};

const mockPrismaService = {
  rfq: {
    findUnique: vi.fn(),
  },
};

async function buildService() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AiQuoteGenerationService,
      { provide: LlmService, useValue: mockLlmService },
      { provide: PrismaService, useValue: mockPrismaService },
    ],
  }).compile();
  return moduleRef.get(AiQuoteGenerationService);
}

describe("AiQuoteGenerationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 503 when OPENAI_API_KEY is not configured", async () => {
    mockLlmService.isConfigured.mockReturnValue(false);
    const service = await buildService();
    await expect(service.generate("rfq-1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("includes RFQ body and extracted items in prompt", async () => {
    mockLlmService.isConfigured.mockReturnValue(true);
    mockLlmService.getModel.mockReturnValue("gpt-4o-mini");
    mockPrismaService.rfq.findUnique.mockResolvedValue({
      id: "rfq-1",
      intake: {
        subject: "RFQ: cabin filters",
        body: "Please quote 60 cabin filters part# CF-123.",
        senderName: "Alex Buyer",
        senderEmail: "alex@fleet.example",
      },
      extractedItems: [
        { partNumber: "CF-123", description: "Cabin filter", quantity: 60, unit: "pcs" },
      ],
    });
    mockLlmService.completeJson.mockResolvedValue({
      customerName: "Alex Buyer",
      customerCompany: "Fleet Co",
      notes: null,
      lineItems: [{ description: "Cabin filter CF-123", quantity: 60, unitPrice: null }],
    });

    const service = await buildService();
    await service.generate("rfq-1");

    const [, userPrompt] = mockLlmService.completeJson.mock.calls[0] as [string, string];
    expect(userPrompt).toContain("cabin filters");
    expect(userPrompt).toContain("CF-123");
  });
});
