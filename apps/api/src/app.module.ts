import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";

import { ApiRequestLogInterceptor } from "./audit/api-request-log.interceptor";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { ConnectorRegistryModule } from "./connector-registry/connector-registry.module";
import { GmailModule } from "./gmail/gmail.module";
import { HealthController } from "./health.controller";
import { CatalogueModule } from "./catalogue/catalogue.module";
import { JobsModule } from "./jobs/jobs.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QuoteEmailModule } from "./quote-email/quote-email.module";
import { QuotesModule } from "./quotes/quotes.module";
import { RbacGuard } from "./rbac/rbac.guard";
import { RbacModule } from "./rbac/rbac.module";
import { RfqsModule } from "./rfqs/rfqs.module";
import { SlackModule } from "./slack/slack.module";
import { OutlookModule } from "./outlook/outlook.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { UsersModule } from "./users/users.module";
import { SettingsModule } from "./settings/settings.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(
      process.env['NODE_ENV'] === 'test'
        ? [{ ttl: 60000, limit: 10000 }]
        : [{ ttl: 60000, limit: 60 }],
    ),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
      },
    }),
    AuditModule,
    AuthModule,
    CatalogueModule,
    SchedulerModule,
    ConnectorRegistryModule,
    JobsModule,
    RfqsModule,
    QuotesModule,
    QuoteEmailModule,
    GmailModule,
    SlackModule,
    OutlookModule,
    RbacModule,
    UsersModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiRequestLogInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
  ],
})
export class AppModule {}
