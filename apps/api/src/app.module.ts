import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { I18nModule, AcceptLanguageResolver, HeaderResolver } from "nestjs-i18n";
import * as path from "path";

import { ApiRequestLogInterceptor } from "./audit/api-request-log.interceptor";
import { SentryInterceptor } from "./sentry/sentry.interceptor";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { BillingGuard } from "./billing/billing.guard";
import { ConfigModule } from "./config/config.module";
import { ConnectorRegistryModule } from "./connector-registry/connector-registry.module";
import { HealthController } from "./health.controller";
import { CatalogueModule } from "./catalogue/catalogue.module";
import { JobsModule } from "./jobs/jobs.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QuoteEmailModule } from "./quote-email/quote-email.module";
import { RbacGuard } from "./rbac/rbac.guard";
import { RbacModule } from "./rbac/rbac.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { UsersModule } from "./users/users.module";
import { SettingsModule } from "./settings/settings.module";
import { CustomersModule } from "./customers/customers.module";
import { QuoteTemplatesModule } from "./quote-templates/quote-templates.module";
import { SlaModule } from "./sla/sla.module";
import { SetupModule } from "./setup/setup.module";
import { WorkspaceModule } from "./workspace/workspace.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { PortalModule } from "./portal/portal.module";
import { PluginRegistryModule } from "./plugin-registry";
import { GmailPlugin } from "./gmail/gmail.plugin";
import { SlackPlugin } from "./slack/slack.plugin";
import { OutlookPlugin } from "./outlook/outlook.plugin";
import { WhatsappPlugin } from "./whatsapp/whatsapp.plugin";
import { TelegramPlugin } from "./telegram/telegram.plugin";
import { ZaloPlugin } from "./zalo/zalo.plugin";
import { RfqsModule } from "./rfqs/rfqs.module";
import { QuotesModule } from "./quotes/quotes.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { SlackModule } from "./slack/slack.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { TelegramModule } from "./telegram/telegram.module";
import { ZaloModule } from "./zalo/zalo.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    I18nModule.forRoot({
      fallbackLanguage: "en",
      loaderOptions: {
        path: path.join(__dirname, "/i18n/"),
        watch: true,
      },
      resolvers: [
        { use: HeaderResolver, options: ["x-lang"] },
        AcceptLanguageResolver,
      ],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(
      process.env['NODE_ENV'] === 'test'
        ? [{ name: 'default', ttl: 60000, limit: 10000 }, { name: 'auth', ttl: 60000, limit: 10000 }, { name: 'public', ttl: 60000, limit: 10000 }]
        : [{ name: 'default', ttl: 60000, limit: 60 }, { name: 'auth', ttl: 300000, limit: 5 }, { name: 'public', ttl: 60000, limit: 30 }],
    ),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
      },
    }),
    PluginRegistryModule.register([
      GmailPlugin,
      SlackPlugin,
      OutlookPlugin,
      WhatsappPlugin,
      TelegramPlugin,
      ZaloPlugin,
    ]),
    AuditModule,
    AuthModule,
    BillingModule,
    CatalogueModule,
    SchedulerModule,
    ConnectorRegistryModule,
    JobsModule,
    QuoteEmailModule,
    RbacModule,
    UsersModule,
    SettingsModule,
    CustomersModule,
    QuoteTemplatesModule,
    SlaModule,
    SetupModule,
    WorkspaceModule,
    AnalyticsModule,
    PortalModule,
    RfqsModule,
    QuotesModule,
    WebhooksModule,
    SlackModule,
    WhatsappModule,
    TelegramModule,
    ZaloModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
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
    {
      provide: APP_GUARD,
      useClass: BillingGuard,
    },
  ],
})
export class AppModule {}
