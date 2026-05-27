import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ItemMatchingService } from "./item-matching.service";

@Module({
  imports: [PrismaModule],
  providers: [ItemMatchingService],
  exports: [ItemMatchingService],
})
export class MatchingModule {}
