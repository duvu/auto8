import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { QuoteTemplatesController } from "./quote-templates.controller";
import { QuoteTemplatesService } from "./quote-templates.service";

@Module({
  imports: [PrismaModule],
  controllers: [QuoteTemplatesController],
  providers: [QuoteTemplatesService],
  exports: [QuoteTemplatesService],
})
export class QuoteTemplatesModule {}
