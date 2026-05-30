import { forwardRef, Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { LlmModule } from "../llm/llm.module";
import { JobsModule } from "../jobs/jobs.module";
import { CatalogueService } from "./catalogue.service";
import { CatalogueEnrichmentService } from "./catalogue-enrichment.service";
import { CatalogueController } from "./catalogue.controller";

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    LlmModule,
    MulterModule.register({ storage: undefined }),
    forwardRef(() => JobsModule),
  ],
  controllers: [CatalogueController],
  providers: [CatalogueService, CatalogueEnrichmentService],
  exports: [CatalogueService],
})
export class CatalogueModule {}
