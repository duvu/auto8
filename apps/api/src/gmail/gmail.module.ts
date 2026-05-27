import { Module } from "@nestjs/common";

import { RfqsModule } from "../rfqs/rfqs.module";
import { GmailController } from "./gmail.controller";
import { GmailConnectorService } from "./gmail.service";

@Module({
  imports: [RfqsModule],
  controllers: [GmailController],
  providers: [GmailConnectorService],
  exports: [GmailConnectorService],
})
export class GmailModule {}
