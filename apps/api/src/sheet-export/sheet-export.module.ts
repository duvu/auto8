import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { SheetExportService } from "./sheet-export.service";

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [SheetExportService],
  exports: [SheetExportService],
})
export class SheetExportModule {}
