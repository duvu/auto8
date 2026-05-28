import { beforeEach, describe, expect, it, vi } from "vitest";

import { LlmService } from "../llm/llm.service";
import { PrismaService } from "../prisma/prisma.service";
import { RfqExtractionService } from "./rfq-extraction.service";

function makePrisma() {
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const createMany = vi.fn().mockResolvedValue({ count: 2 });

  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
    await fn({
      rfqExtractedItem: { deleteMany, createMany },
    });
  });

  return {
    rfq: {
      findUnique: vi.fn().mockResolvedValue({
        id: "rfq-1",
        intake: { subject: "RFQ: brake discs", body: "Please quote 20 brake discs part# BD-100." },
      }),
    },
    rfqExtractedItem: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction,
    _deleteMany: deleteMany,
    _createMany: createMany,
  };
}

function makeLlm(result: unknown) {
  return { completeJson: vi.fn().mockResolvedValue(result) };
}

describe("RfqExtractionService", () => {
  let service: RfqExtractionService;
  let prisma: ReturnType<typeof makePrisma>;
  let llm: ReturnType<typeof makeLlm>;

  beforeEach(() => {
    prisma = makePrisma();
    llm = makeLlm({
      items: [
        { partNumber: "BD-100", description: "Brake disc", quantity: 20, unit: "pcs", confidence: 0.95 },
        { partNumber: null, description: "Brake pad set", quantity: 5, unit: "set", confidence: 0.80 },
      ],
    });
    service = new RfqExtractionService(prisma as unknown as PrismaService, llm as unknown as LlmService);
  });

  it("calls deleteMany and createMany with correct data when LLM returns items", async () => {
    await service.extractAsync("rfq-1");

    expect(llm.completeJson).toHaveBeenCalledOnce();
    expect(prisma._deleteMany).toHaveBeenCalledWith({ where: { rfqId: "rfq-1" } });
    expect(prisma._createMany).toHaveBeenCalledWith({
      data: [
        { rfqId: "rfq-1", partNumber: "BD-100", description: "Brake disc", quantity: 20, unit: "pcs", confidence: 0.95 },
        { rfqId: "rfq-1", partNumber: null, description: "Brake pad set", quantity: 5, unit: "set", confidence: 0.80 },
      ],
    });
  });

  it("no-ops when LlmService returns null (unconfigured)", async () => {
    llm = makeLlm(null);
    service = new RfqExtractionService(prisma as unknown as PrismaService, llm as unknown as LlmService);

    await service.extractAsync("rfq-1");

    expect(prisma._deleteMany).not.toHaveBeenCalled();
    expect(prisma._createMany).not.toHaveBeenCalled();
  });

  it("does not throw on errors — catches and logs", async () => {
    prisma.rfq.findUnique = vi.fn().mockRejectedValue(new Error("DB error"));

    await expect(service.extractAsync("rfq-1")).resolves.toBeUndefined();
  });
});
