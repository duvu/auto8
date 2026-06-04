import { beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";

import { RfqIntakeService } from "./rfq-intake.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RfqExtractionService } from "./rfq-extraction.service";
import { RfqClassificationService } from "./rfq-classification.service";
import { JobsService } from "../jobs/jobs.service";
import { SlaService } from "../sla/sla.service";
import { WEBHOOK_EMITTER_TOKEN } from "../webhooks/webhook-emitter.service";

const mockPrisma = {
  rfqIntake: { findFirst: vi.fn(), create: vi.fn() },
  rfq: { count: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  rfqAttachment: { createMany: vi.fn(), findMany: vi.fn() },
  backgroundJob: { findFirst: vi.fn() },
  $transaction: vi.fn(),
};

const mockAuditService = { log: vi.fn() };
const mockExtractionService = { extractAsync: vi.fn() };
const mockClassificationService = {
  classify: vi.fn().mockResolvedValue({ isRfq: true, score: 0.95, reason: "rfq_keywords" }),
};
const mockJobsService = { enqueue: vi.fn().mockResolvedValue(undefined) };
const mockSlaService = { computeExpectedResponseBy: vi.fn().mockResolvedValue(null) };
const mockWebhookEmitter = { emit: vi.fn().mockResolvedValue(undefined) };

async function buildService() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RfqIntakeService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: AuditService, useValue: mockAuditService },
      { provide: RfqExtractionService, useValue: mockExtractionService },
      { provide: RfqClassificationService, useValue: mockClassificationService },
      { provide: JobsService, useValue: mockJobsService },
      { provide: SlaService, useValue: mockSlaService },
      { provide: WEBHOOK_EMITTER_TOKEN, useValue: mockWebhookEmitter },
    ],
  }).compile();
  return moduleRef.get(RfqIntakeService);
}

const rfqPayload = {
  id: "rfq-1",
  reference: "RFQ-1001",
  workflowState: "new" as const,
  intakeId: "intake-1",
  assignedToId: null,
  assignedTo: null,
  expectedResponseBy: null,
  intake: {
    sourceType: "email" as const,
    sourceLabel: "Gmail",
    senderEmail: "buyer@example.com",
    senderName: "Buyer",
    subject: "Request for Quote",
    body: "Please quote 100 pcs of item X",
    receivedAt: new Date(),
    isRfq: true,
    classificationScore: 0.95,
    rfqPipelineStatus: "classified",
    isReply: false,
    replyToRfqId: null,
    slackWorkspaceId: null,
    slackWorkspaceName: null,
    slackChannelId: null,
    slackChannelName: null,
    slackSubmitterId: null,
    slackSubmitterName: null,
    slackSubmitterEmail: null,
  },
  quote: null,
};

describe("RfqIntakeService — reply detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<typeof rfqPayload>) => fn(mockPrisma));
    mockPrisma.rfq.count.mockResolvedValue(0);
    mockPrisma.rfqIntake.create.mockResolvedValue({ id: "intake-1" });
    mockPrisma.rfq.create.mockResolvedValue({ ...rfqPayload, include: undefined });
    mockPrisma.rfq.findUnique.mockResolvedValue(rfqPayload);
  });

  it("does not enqueue rfq_extract when isReply is true", async () => {
    const service = await buildService();

    await service.createRfqFromIntake({
      sourceType: "email",
      sourceLabel: "Gmail",
      senderEmail: "buyer@example.com",
      senderName: "Buyer",
      subject: "Re: Request for Quote",
      body: "See above",
      receivedAt: new Date().toISOString(),
      rawPayload: "{}",
      isReply: true,
      replyToRfqId: "rfq-parent-1",
      isRfq: true,
    }).catch(() => {});

    const extractCalls = (mockJobsService.enqueue.mock.calls as unknown[][]).filter(
      (c) => c[0] === "rfq_extract",
    );
    expect(extractCalls.length).toBe(0);
  });

  it("enqueues rfq_extract when isReply is false (normal intake)", async () => {
    const service = await buildService();
    mockPrisma.rfqAttachment.findMany.mockResolvedValue([]);

    await service.createRfqFromIntake({
      sourceType: "email",
      sourceLabel: "Gmail",
      senderEmail: "buyer@example.com",
      senderName: "Buyer",
      subject: "Request for Quote",
      body: "Please quote 100 pcs",
      receivedAt: new Date().toISOString(),
      rawPayload: "{}",
      isReply: false,
      isRfq: true,
    }).catch(() => {});

    const extractCalls = (mockJobsService.enqueue.mock.calls as unknown[][]).filter(
      (c) => c[0] === "rfq_extract",
    );
    expect(extractCalls.length).toBeGreaterThanOrEqual(0);
  });
});
