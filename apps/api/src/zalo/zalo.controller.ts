import { Body, Controller, Get, Logger, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";

import { Public } from "../rbac/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { ZaloConnectorService } from "./zalo-connector.service";
import type { ZaloWebhookPayload } from "./dto/zalo-webhook.dto";

@Controller("webhooks/zalo")
export class ZaloController {
  private readonly logger = new Logger(ZaloController.name);

  constructor(
    private readonly zaloService: ZaloConnectorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(":connectorId")
  @Public()
  async verifyWebhook(
    @Param("connectorId") connectorId: string,
    @Query("verifyToken") verifyToken: string,
    @Query("challenge") challenge: string,
    @Res() res: Response,
  ): Promise<void> {
    const connector = await this.prisma.connector.findFirst({
      where: { id: connectorId, type: "zalo", isEnabled: true },
    });
    if (!connector) {
      res.status(403).send("Connector not found");
      return;
    }
    try {
      const result = this.zaloService.verifyChallenge(connector, verifyToken, challenge);
      res.status(200).send(result);
    } catch {
      res.status(403).send("Invalid verifyToken");
    }
  }

  @Post(":connectorId")
  @Public()
  async handleWebhook(
    @Param("connectorId") connectorId: string,
    @Body() body: ZaloWebhookPayload,
  ): Promise<{ ok: boolean }> {
    const connector = await this.prisma.connector.findFirst({
      where: { id: connectorId, type: "zalo", isEnabled: true },
    });
    if (!connector) {
      this.logger.warn(`No enabled Zalo connector for id ${connectorId} — ignoring webhook.`);
      return { ok: true };
    }
    return this.zaloService.processWebhook(connector, body);
  }
}
