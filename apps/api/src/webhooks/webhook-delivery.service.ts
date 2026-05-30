import { createHmac } from "node:crypto";

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { JobsService } from "../jobs/jobs.service";
import { WebhookEndpointService } from "./webhook-endpoint.service";

const RETRY_DELAYS_MS = [30_000, 5 * 60_000]; // 30s, 5m for attempts 2 and 3

@Injectable()
export class WebhookDeliveryService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly endpointService: WebhookEndpointService,
  ) {}

  onModuleInit(): void {
    this.jobsService.registerHandler("webhook_deliver" as Parameters<typeof this.jobsService.registerHandler>[0], async (payload) => {
      const endpointId = payload["endpointId"] as string;
      const event = payload["event"] as string;
      const body = payload["payload"] as Record<string, unknown>;
      const deliveryId = payload["deliveryId"] as string | undefined;

      await this.deliver(endpointId, event, body, deliveryId);
    });
  }

  async deliver(endpointId: string, event: string, body: Record<string, unknown>, deliveryId?: string): Promise<void> {
    let endpoint;
    try {
      endpoint = await this.endpointService.findOne(endpointId);
    } catch {
      this.logger.warn(`WebhookEndpoint ${endpointId} not found, skipping delivery.`);
      return;
    }

    const secret = this.endpointService.decryptSecret(endpoint.secret);
    const payloadStr = JSON.stringify({ event, ...body });
    const sig = `sha256=${createHmac("sha256", secret).update(payloadStr).digest("hex")}`;

    let responseStatus: number | null = null;
    let lastError: string | null = null;
    let status = "delivered";

    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auto8-Signature-256": sig },
        body: payloadStr,
      });
      responseStatus = res.status;
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        status = "failed";
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      status = "failed";
    }

    if (deliveryId) {
      const current = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
      const attemptCount = (current?.attemptCount ?? 0) + 1;
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status,
          responseStatus,
          lastError,
          attemptCount,
          deliveredAt: status === "delivered" ? new Date() : null,
        },
      });

      if (status === "failed" && attemptCount < 3) {
        const delayMs = RETRY_DELAYS_MS[attemptCount - 1] ?? 5 * 60_000;
        setTimeout(() => {
          this.jobsService.enqueue("webhook_deliver" as Parameters<typeof this.jobsService.enqueue>[0], {
            endpointId, event, payload: body, deliveryId,
          }).catch((err: unknown) => this.logger.error("Failed to re-enqueue webhook_deliver", err));
        }, delayMs);
      }
    } else {
      await this.prisma.webhookDelivery.create({
        data: {
          endpointId,
          event,
          payload: body as Parameters<typeof this.prisma.webhookDelivery.create>[0]["data"]["payload"],
          status,
          responseStatus,
          lastError,
          attemptCount: 1,
          deliveredAt: status === "delivered" ? new Date() : null,
        },
      });
    }
  }
}
