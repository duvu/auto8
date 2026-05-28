import { Module } from "@nestjs/common";

import { RfqsModule } from "../rfqs/rfqs.module";
import { SlackConnectorService } from "./slack-connector.service";
import { SlackController } from "./slack.controller";

@Module({
  imports: [RfqsModule],
  controllers: [SlackController],
  providers: [SlackConnectorService],
  exports: [SlackConnectorService],
})
export class SlackModule {}
