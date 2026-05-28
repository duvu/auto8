import { beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";

import { RfqClassificationService } from "./rfq-classification.service";
import { LlmService } from "../llm/llm.service";

const mockLlmService = {
  completeJson: vi.fn(),
};

const mockConfigService = {
  get: vi.fn(),
};

async function buildService() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RfqClassificationService,
      { provide: LlmService, useValue: mockLlmService },
      { provide: ConfigService, useValue: mockConfigService },
    ],
  }).compile();

  return moduleRef.get(RfqClassificationService);
}

describe("RfqClassificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pass-through when no API key", async () => {
    mockConfigService.get.mockReturnValue(undefined);
    const service = await buildService();
    const result = await service.classify("Subject", "Body");
    expect(result).toEqual({ isRfq: true, score: 1.0, reason: "classification_disabled" });
    expect(mockLlmService.completeJson).not.toHaveBeenCalled();
  });

  it("returns pass-through on LLM error", async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "test-key";
      if (key === "RFQ_CLASSIFICATION_THRESHOLD") return 0.7;
    });
    mockLlmService.completeJson.mockRejectedValue(new Error("LLM timeout"));
    const service = await buildService();
    const result = await service.classify("Subject", "Body");
    expect(result).toEqual({ isRfq: true, score: 1.0, reason: "classification_error" });
  });

  it("returns isRfq: true when score >= threshold", async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "test-key";
      if (key === "RFQ_CLASSIFICATION_THRESHOLD") return 0.7;
    });
    mockLlmService.completeJson.mockResolvedValue({ isRfq: true, score: 0.9, reason: "has part numbers" });
    const service = await buildService();
    const result = await service.classify("RFQ: cabin filters", "Please quote 60 filters.");
    expect(result.isRfq).toBe(true);
    expect(result.score).toBe(0.9);
    expect(result.reason).toBe("has part numbers");
  });

  it("returns isRfq: false when score < threshold", async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "test-key";
      if (key === "RFQ_CLASSIFICATION_THRESHOLD") return 0.7;
    });
    mockLlmService.completeJson.mockResolvedValue({ isRfq: false, score: 0.2, reason: "newsletter" });
    const service = await buildService();
    const result = await service.classify("Newsletter", "Check out our latest products!");
    expect(result.isRfq).toBe(false);
    expect(result.score).toBe(0.2);
  });
});
