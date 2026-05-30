import { Injectable, Logger } from "@nestjs/common";

import { JobsService } from "../jobs/jobs.service";
import { WebhookEndpointService } from "./webhook-endpoint.service";

@Injectable()
export class WebhookEmitterService {
  private readonly logger = new Logger(WebhookEmitterService.name);

  constructor(
    private readonly endpointService: WebhookEndpointService,
    private readonly jobsService: JobsService,
  ) {}

  async emit(event: string, payload: Record<string, unknown>): Promise<void> {
    const endpoints = await this.endpointService.findEnabledForEvent(event);
    for (const ep of endpoints) {
      this.jobsService
        .enqueue("webhook_deliver" as Parameters<typeof this.jobsService.enqueue>[0], {
          endpointId: ep.id,
          event,
          payload,
        })
        .catch((err: unknown) => this.logger.error(`Failed to enqueue webhook_deliver for ${ep.id}`, err));
    }
  }
}
