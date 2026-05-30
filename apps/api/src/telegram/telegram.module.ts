import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { RfqsModule } from "../rfqs/rfqs.module";
import { TelegramConnectorService } from "./telegram-connector.service";
import { TelegramController } from "./telegram.controller";

@Module({
  imports: [PrismaModule, RfqsModule],
  controllers: [TelegramController],
  providers: [TelegramConnectorService],
  exports: [TelegramConnectorService],
})
export class TelegramModule {}
