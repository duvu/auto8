import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { RfqsModule } from "../rfqs/rfqs.module";
import { ZaloConnectorService } from "./zalo-connector.service";
import { ZaloController } from "./zalo.controller";

@Module({
  imports: [PrismaModule, RfqsModule],
  controllers: [ZaloController],
  providers: [ZaloConnectorService],
  exports: [ZaloConnectorService],
})
export class ZaloModule {}
