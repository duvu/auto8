import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { CatalogueService } from "./catalogue.service";
import { CatalogueController } from "./catalogue.controller";

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    MulterModule.register({ storage: undefined }), // Use memory storage (buffer)
  ],
  controllers: [CatalogueController],
  providers: [CatalogueService],
  exports: [CatalogueService],
})
export class CatalogueModule {}
