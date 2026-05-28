import { Module } from "@nestjs/common";

import { ConnectorRunModule } from "../scheduler/connector-run.module";
import { RfqsModule } from "../rfqs/rfqs.module";
import { GmailController } from "./gmail.controller";
import { GmailConnectorService } from "./gmail.service";

@Module({
  imports: [RfqsModule, ConnectorRunModule],
  controllers: [GmailController],
  providers: [GmailConnectorService],
  exports: [GmailConnectorService],
})
export class GmailModule {}
