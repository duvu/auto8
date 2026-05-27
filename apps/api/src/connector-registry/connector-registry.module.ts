import { Module, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { GmailModule } from "../gmail/gmail.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { SlackModule } from "../slack/slack.module";
import { ConnectorRegistryController } from "./connector-registry.controller";
import { ConnectorRegistryService } from "./connector-registry.service";

@Module({
  imports: [PrismaModule, RbacModule, GmailModule, SlackModule],
  providers: [ConnectorRegistryService, ConnectorRegistryController],
  exports: [ConnectorRegistryService],
  controllers: [ConnectorRegistryController],
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
  }
}
