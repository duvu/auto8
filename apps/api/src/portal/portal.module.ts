import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { EmailModule } from "../email/email.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";

@Module({
  imports: [PrismaModule, ConfigModule, EmailModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
