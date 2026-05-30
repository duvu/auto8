import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { SlaController } from "./sla.controller";
import { SlaService } from "./sla.service";

@Module({
  imports: [PrismaModule],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
