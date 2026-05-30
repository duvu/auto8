import { Module, OnModuleInit } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR, ModuleRef } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { I18nModule, AcceptLanguageResolver, HeaderResolver } from "nestjs-i18n";
import * as path from "path";

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
import { CustomersModule } from "./customers/customers.module";
import { QuoteTemplatesModule } from "./quote-templates/quote-templates.module";
import { SlaModule } from "./sla/sla.module";
import { SetupModule } from "./setup/setup.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { TelegramModule } from "./telegram/telegram.module";
import { ZaloModule } from "./zalo/zalo.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { WebhookEmitterService } from "./webhooks/webhook-emitter.service";
import { RfqIntakeService } from "./rfqs/rfq-intake.service";
import { QuoteWorkflowService } from "./rfqs/quote-workflow.service";
import { QuoteEmailService } from "./quote-email/quote-email.service";

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
    CustomersModule,
    QuoteTemplatesModule,
    SlaModule,
    SetupModule,
    WhatsappModule,
    TelegramModule,
    ZaloModule,
    WebhooksModule,
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
export class AppModule implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    const emitter = this.moduleRef.get(WebhookEmitterService, { strict: false });

    const rfqIntake = this.moduleRef.get(RfqIntakeService, { strict: false });
    rfqIntake.webhookEmitter = emitter;

    const quoteWorkflow = this.moduleRef.get(QuoteWorkflowService, { strict: false });
    quoteWorkflow.webhookEmitter = emitter;

    const quoteEmail = this.moduleRef.get(QuoteEmailService, { strict: false });
    quoteEmail.webhookEmitter = emitter;
  }
}
