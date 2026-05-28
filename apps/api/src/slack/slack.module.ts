import { Module } from "@nestjs/common";

import { ConnectorRunModule } from "../scheduler/connector-run.module";
import { RfqsModule } from "../rfqs/rfqs.module";
import { SlackConnectorService } from "./slack-connector.service";
import { SlackController } from "./slack.controller";

@Module({
  imports: [RfqsModule, ConnectorRunModule],
  controllers: [SlackController],
  providers: [SlackConnectorService],
  exports: [SlackConnectorService],
})
export class SlackModule {}
