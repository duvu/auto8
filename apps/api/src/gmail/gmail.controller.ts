import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ConnectorSyncSummary } from "@auto8/shared";
import { Public } from "../rbac/public.decorator";
import { ConnectorRunService } from "../scheduler/connector-run.service";
import { GmailConnectorService } from "./gmail.service";

@Controller("connectors/gmail")
export class GmailController {
  constructor(
    private readonly gmailConnectorService: GmailConnectorService,
    private readonly connectorRunService: ConnectorRunService,
    private readonly config: ConfigService
  ) {}

  @Post("sync")
  @Public()
  async sync(
    @Headers("x-connector-secret") secret: string | undefined,
    @Body() body: { query?: string }
  ): Promise<ConnectorSyncSummary> {
    this.verifyConnectorSecret(secret);
    let result!: ConnectorSyncSummary;
    await this.connectorRunService.runConnector("gmail", async () => {
      result = await this.gmailConnectorService.syncLegacy(body.query);
      return result;
    }, { rethrow: true });
    return result;
  }

  private verifyConnectorSecret(provided: string | undefined) {
    const expected = this.config.get<string>("GMAIL_CONNECTOR_SECRET")?.trim();

    if (!expected) {
      throw new UnauthorizedException("Gmail connector secret is not configured.");
    }

    if (!provided || provided.trim() !== expected) {
      throw new UnauthorizedException("Invalid connector secret.");
    }
  }
}
