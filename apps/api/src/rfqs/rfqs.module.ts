import { forwardRef, Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { JobsModule } from "../jobs/jobs.module";
import { LlmModule } from "../llm/llm.module";
import { MatchingModule } from "../matching/matching.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuoteEmailModule } from "../quote-email/quote-email.module";
import { RbacModule } from "../rbac/rbac.module";
import { SlaModule } from "../sla/sla.module";
import { AiQuoteGenerationService } from "./ai-quote-generation.service";
import { RfqExtractionService } from "./rfq-extraction.service";
import { RfqClassificationService } from "./rfq-classification.service";
import { RfqIntakeService } from "./rfq-intake.service";
import { QuoteWorkflowService } from "./quote-workflow.service";
import { RfqsController } from "./rfqs.controller";

@Module({
  imports: [AuditModule, QuoteEmailModule, LlmModule, RbacModule, forwardRef(() => JobsModule), MatchingModule, PrismaModule, SlaModule],
  controllers: [RfqsController],
  providers: [RfqIntakeService, QuoteWorkflowService, RfqExtractionService, RfqClassificationService, AiQuoteGenerationService],
  exports: [RfqIntakeService, QuoteWorkflowService, RfqExtractionService],
})
export class RfqsModule {}
