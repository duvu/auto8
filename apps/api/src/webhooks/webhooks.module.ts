import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { JobsModule } from "../jobs/jobs.module";
import { WebhookEndpointController } from "./webhook-endpoint.controller";
import { WebhookEndpointService } from "./webhook-endpoint.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookEmitterService } from "./webhook-emitter.service";

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [WebhookEndpointController],
  providers: [WebhookEndpointService, WebhookDeliveryService, WebhookEmitterService],
  exports: [WebhookEmitterService],
})
export class WebhooksModule {}
