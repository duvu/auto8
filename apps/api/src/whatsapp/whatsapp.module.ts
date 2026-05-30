import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { RfqsModule } from "../rfqs/rfqs.module";
import { WhatsappConnectorService } from "./whatsapp-connector.service";
import { WhatsappController } from "./whatsapp.controller";

@Module({
  imports: [PrismaModule, RfqsModule],
  controllers: [WhatsappController],
  providers: [WhatsappConnectorService],
  exports: [WhatsappConnectorService],
})
export class WhatsappModule {}
