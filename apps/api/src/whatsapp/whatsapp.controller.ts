import { Controller, Get, Logger, Post, Query, Req } from "@nestjs/common";

import { Public } from "../rbac/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappConnectorService } from "./whatsapp-connector.service";

@Controller("webhooks/whatsapp")
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappConnectorService,
    private readonly prisma: PrismaService,
  ) {}

  /** Meta webhook verification handshake */
  @Get()
  @Public()
  async verifyChallenge(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ): Promise<string> {
    const connector = await this.prisma.connector.findFirst({ where: { type: "whatsapp", isEnabled: true } });
    if (!connector) {
      this.logger.warn("No enabled WhatsApp connector found for verification.");
      return "";
    }
    return this.whatsappService.verifyChallenge(connector, mode, token, challenge);
  }

  /** Incoming message webhook */
  @Post()
  @Public()
  async handleWebhook(
    @Req() request: { rawBody?: Buffer; body: Record<string, unknown>; headers: Record<string, string | string[] | undefined> },
  ): Promise<{ ok: boolean }> {
    const rawPayload = request.rawBody?.toString("utf8") ?? JSON.stringify(request.body);
    const connector = await this.prisma.connector.findFirst({ where: { type: "whatsapp", isEnabled: true } });
    if (!connector) {
      this.logger.warn("No enabled WhatsApp connector — ignoring webhook.");
      return { ok: true };
    }
    this.whatsappService.verifySignature(request.headers, rawPayload, connector);
    return this.whatsappService.processWebhook(request.body, connector);
  }
}
