import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { RfqsService } from "../rfqs/rfqs.service";
import { QuotesController } from "./quotes.controller";

@Module({
  controllers: [QuotesController],
  providers: [PrismaService, RfqsService]
})
export class QuotesModule {}
