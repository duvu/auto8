import { Module } from "@nestjs/common";

import { QuoteEmailModule } from "../quote-email/quote-email.module";
import { RbacModule } from "../rbac/rbac.module";
import { RfqsModule } from "../rfqs/rfqs.module";
import { QuotesController } from "./quotes.controller";

@Module({
  imports: [RfqsModule, QuoteEmailModule, RbacModule],
  controllers: [QuotesController],
})
export class QuotesModule {}
