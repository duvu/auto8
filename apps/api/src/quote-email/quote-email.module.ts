import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LlmModule } from "../llm/llm.module";
import { RbacModule } from "../rbac/rbac.module";
import { QuoteEmailService } from "./quote-email.service";
import { QuoteEmailController } from "./quote-email.controller";
import { SmartEmailGenerationService } from "./smart-email-generation.service";

@Module({
  imports: [AuditModule, LlmModule, RbacModule],
  providers: [QuoteEmailService, SmartEmailGenerationService],
  controllers: [QuoteEmailController],
  exports: [QuoteEmailService],
})
export class QuoteEmailModule {}
