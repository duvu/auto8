import { beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";

import { WebhookEmitterService } from "./webhook-emitter.service";
import { WebhookEndpointService } from "./webhook-endpoint.service";
import { JobsService } from "../jobs/jobs.service";

const mockEndpointService = { findEnabledForEvent: vi.fn() };
const mockJobsService = { enqueue: vi.fn().mockResolvedValue(undefined) };

async function buildService() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      WebhookEmitterService,
      { provide: WebhookEndpointService, useValue: mockEndpointService },
      { provide: JobsService, useValue: mockJobsService },
    ],
  }).compile();
  return moduleRef.get(WebhookEmitterService);
}

describe("WebhookEmitterService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues one webhook_deliver job per matching endpoint", async () => {
    mockEndpointService.findEnabledForEvent.mockResolvedValue([
      { id: "ep-1" },
      { id: "ep-2" },
    ]);
    const service = await buildService();

    await service.emit("rfq.created", { rfqId: "rfq-1" });

    expect(mockJobsService.enqueue).toHaveBeenCalledTimes(2);
    expect(mockJobsService.enqueue).toHaveBeenCalledWith("webhook_deliver", {
      endpointId: "ep-1",
      event: "rfq.created",
      payload: { rfqId: "rfq-1" },
    });
    expect(mockJobsService.enqueue).toHaveBeenCalledWith("webhook_deliver", {
      endpointId: "ep-2",
      event: "rfq.created",
      payload: { rfqId: "rfq-1" },
    });
  });

  it("enqueues no jobs when no endpoints match", async () => {
    mockEndpointService.findEnabledForEvent.mockResolvedValue([]);
    const service = await buildService();

    await service.emit("rfq.created", { rfqId: "rfq-1" });

    expect(mockJobsService.enqueue).not.toHaveBeenCalled();
  });

  it("queries endpoints by event name", async () => {
    mockEndpointService.findEnabledForEvent.mockResolvedValue([]);
    const service = await buildService();

    await service.emit("quote.approved", { quoteId: "q-1" });

    expect(mockEndpointService.findEnabledForEvent).toHaveBeenCalledWith("quote.approved");
  });
});
