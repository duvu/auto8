import { Module } from "@nestjs/common";

import { ConnectorRegistryModule } from "../connector-registry/connector-registry.module";
import { GmailModule } from "../gmail/gmail.module";
import { ConnectorRunModule } from "./connector-run.module";
import { ConnectorRunsController } from "./connector-runs.controller";
import { ConnectorRunsService } from "./connector-runs.service";
import { SchedulerService } from "./scheduler.service";

@Module({
  imports: [GmailModule, ConnectorRunModule, ConnectorRegistryModule],
  controllers: [ConnectorRunsController],
  providers: [SchedulerService, ConnectorRunsService],
  exports: [ConnectorRunsService],
})
export class SchedulerModule {}
