import { Module } from "@nestjs/common";

import { GmailModule } from "./gmail/gmail.module";
import { HealthController } from "./health.controller";
import { PrismaService } from "./prisma/prisma.service";
import { QuotesModule } from "./quotes/quotes.module";
import { RfqsController } from "./rfqs/rfqs.controller";
import { RfqsService } from "./rfqs/rfqs.service";
import { UsersController } from "./users/users.controller";
import { UsersService } from "./users/users.service";

@Module({
  imports: [QuotesModule, GmailModule],
  controllers: [HealthController, UsersController, RfqsController],
  providers: [PrismaService, UsersService, RfqsService]
})
export class AppModule {}
