import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { Test } from "@nestjs/testing";

import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookEndpointService } from "./webhook-endpoint.service";
import { JobsService } from "../jobs/jobs.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  webhookDelivery: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
};

const mockJobsService = {
  registerHandler: vi.fn(),
  enqueue: vi.fn().mockResolvedValue(undefined),
};

const TEST_SECRET = "webhook-test-secret";

const mockEndpointService = {
  findOne: vi.fn().mockResolvedValue({ id: "ep-1", url: "https://example.com/wh", secret: TEST_SECRET }),
  decryptSecret: vi.fn().mockReturnValue(TEST_SECRET),
};

async function buildService() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      WebhookDeliveryService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: JobsService, useValue: mockJobsService },
      { provide: WebhookEndpointService, useValue: mockEndpointService },
    ],
  }).compile();
  const svc = moduleRef.get(WebhookDeliveryService);
  svc.onModuleInit();
  return svc;
}

describe("WebhookDeliveryService — HMAC signing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEndpointService.findOne.mockResolvedValue({ id: "ep-1", url: "https://example.com/wh", secret: TEST_SECRET });
    mockEndpointService.decryptSecret.mockReturnValue(TEST_SECRET);
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: "del-1", attemptCount: 0 });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it("sends X-Auto8-Signature-256 header with correct HMAC", async () => {
    const service = await buildService();

    await service.deliver("ep-1", "rfq.created", { rfqId: "r-1" });

    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(fetchCalls.length).toBe(1);

    const [, options] = fetchCalls[0] as [string, { headers: Record<string, string>; body: string }];
    const body = options.body;
    const expectedSig = `sha256=${createHmac("sha256", TEST_SECRET).update(body).digest("hex")}`;
    expect(options.headers["X-Auto8-Signature-256"]).toBe(expectedSig);
  });

  it("creates a WebhookDelivery record with status delivered on success", async () => {
    const service = await buildService();

    await service.deliver("ep-1", "rfq.created", { rfqId: "r-1" });

    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "delivered", endpointId: "ep-1", event: "rfq.created" }),
      }),
    );
  });

  it("creates a WebhookDelivery record with status failed on HTTP error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });
    const service = await buildService();

    await service.deliver("ep-1", "rfq.created", { rfqId: "r-1" });

    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });
});
