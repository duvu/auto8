import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { LlmModule } from "../llm/llm.module";
import { ItemMatchingService } from "./item-matching.service";

@Module({
  imports: [PrismaModule, LlmModule, ConfigModule],
  providers: [ItemMatchingService],
  exports: [ItemMatchingService],
})
export class MatchingModule {}
