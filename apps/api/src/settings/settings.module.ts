import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { LlmModule } from "../llm/llm.module";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [PrismaModule, RbacModule, LlmModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
