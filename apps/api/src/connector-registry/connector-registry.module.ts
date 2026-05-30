import { Module, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { GmailModule } from "../gmail/gmail.module";
import { OutlookModule } from "../outlook/outlook.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { SlackModule } from "../slack/slack.module";
import { AuthModule } from "../auth/auth.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { TelegramModule } from "../telegram/telegram.module";
import { ZaloModule } from "../zalo/zalo.module";
import { ConnectorRunsService } from "../scheduler/connector-runs.service";
import { ConnectorRegistryController } from "./connector-registry.controller";
import { ConnectorRegistryService } from "./connector-registry.service";
import { OAuth2Config } from "./oauth2.config";
import { OAuth2ConnectorService } from "./oauth2-connector.service";
import { OAuth2ConnectorController } from "./oauth2-connector.controller";

@Module({
  imports: [PrismaModule, RbacModule, GmailModule, SlackModule, OutlookModule, AuthModule, WhatsappModule, TelegramModule, ZaloModule],
  providers: [ConnectorRegistryService, ConnectorRunsService, OAuth2Config, OAuth2ConnectorService],
  exports: [ConnectorRegistryService],
  controllers: [ConnectorRegistryController, OAuth2ConnectorController],
})
export class ConnectorRegistryModule implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly registryService: ConnectorRegistryService,
  ) {}

  onModuleInit(): void {
    // Lazily resolve Gmail/Slack services to avoid circular deps
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gmail = this.moduleRef.get("GmailConnectorService", { strict: false }) as any;
      if (gmail) this.registryService.gmailService = gmail as typeof this.registryService.gmailService;
    } catch {
      // Not available — connector test for gmail will return error
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slack = this.moduleRef.get("SlackConnectorService", { strict: false }) as any;
      if (slack) this.registryService.slackService = slack as typeof this.registryService.slackService;
    } catch {
      // Not available
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outlook = this.moduleRef.get("OutlookConnectorService", { strict: false }) as any;
      if (outlook) this.registryService.outlookService = outlook as typeof this.registryService.outlookService;
    } catch {
      // Not available
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whatsapp = this.moduleRef.get("WhatsappConnectorService", { strict: false }) as any;
      if (whatsapp) this.registryService.whatsappService = whatsapp as typeof this.registryService.whatsappService;
    } catch {
      // Not available
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const telegram = this.moduleRef.get("TelegramConnectorService", { strict: false }) as any;
      if (telegram) this.registryService.telegramService = telegram as typeof this.registryService.telegramService;
    } catch {
      // Not available
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zalo = this.moduleRef.get("ZaloConnectorService", { strict: false }) as any;
      if (zalo) this.registryService.zaloService = zalo as typeof this.registryService.zaloService;
    } catch {
      // Not available
    }
  }
}
