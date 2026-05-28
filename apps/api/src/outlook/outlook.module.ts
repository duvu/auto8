import { Module } from "@nestjs/common";
import { RfqsModule } from "../rfqs/rfqs.module";
import { OutlookConnectorService } from "./outlook-connector.service";

@Module({
  imports: [RfqsModule],
  providers: [OutlookConnectorService],
  exports: [OutlookConnectorService],
})
export class OutlookModule {}
