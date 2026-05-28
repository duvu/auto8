import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";

import { GmailService } from "./gmail.service";
import { GmailSyncSummary, RfqsService } from "../rfqs/rfqs.service";

@Controller("connectors/gmail")
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly rfqsService: RfqsService
  ) {}

  @Post("sync")
  async sync(
    @Headers("x-connector-secret") secret: string | undefined,
    @Body() body: { query?: string }
  ): Promise<GmailSyncSummary> {
    this.verifyConnectorSecret(secret);
    return this.rfqsService.syncGmail(this.gmailService, body.query);
  }

  private verifyConnectorSecret(provided: string | undefined) {
    const expected = process.env.GMAIL_CONNECTOR_SECRET?.trim();

    if (!expected) {
      throw new UnauthorizedException("Gmail connector secret is not configured.");
    }

    if (!provided || provided.trim() !== expected) {
      throw new UnauthorizedException("Invalid connector secret.");
    }
  }
}
