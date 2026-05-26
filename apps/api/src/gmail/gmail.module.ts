import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { RfqsService } from "../rfqs/rfqs.service";
import { GmailController } from "./gmail.controller";
import { GmailService } from "./gmail.service";

@Module({
  controllers: [GmailController],
  providers: [GmailService, RfqsService, PrismaService]
})
export class GmailModule {}
