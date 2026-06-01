import { forwardRef, Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { JobsModule } from "../jobs/jobs.module";
import { WebhookEndpointController } from "./webhook-endpoint.controller";
import { WebhookEndpointService } from "./webhook-endpoint.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookEmitterService, WEBHOOK_EMITTER_TOKEN } from "./webhook-emitter.service";

@Module({
  imports: [PrismaModule, forwardRef(() => JobsModule)],
  controllers: [WebhookEndpointController],
  providers: [
    WebhookEndpointService,
    WebhookDeliveryService,
    WebhookEmitterService,
    {
      provide: WEBHOOK_EMITTER_TOKEN,
      useExisting: WebhookEmitterService,
    },
  ],
  exports: [WebhookEmitterService, WEBHOOK_EMITTER_TOKEN],
})
export class WebhooksModule {}
