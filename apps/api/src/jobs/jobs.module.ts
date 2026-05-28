import { forwardRef, Module } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { JobsController } from "./jobs.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { AttachmentsModule } from "../attachments/attachments.module";
import { MatchingModule } from "../matching/matching.module";
import { SheetExportModule } from "../sheet-export/sheet-export.module";
import { AuditModule } from "../audit/audit.module";
import { RfqsModule } from "../rfqs/rfqs.module";

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    AttachmentsModule,
    MatchingModule,
    SheetExportModule,
    AuditModule,
    forwardRef(() => RfqsModule),
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
