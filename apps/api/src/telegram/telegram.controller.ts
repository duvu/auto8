import { Body, Controller, Logger, Param, Post } from "@nestjs/common";

import { Public } from "../rbac/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramConnectorService } from "./telegram-connector.service";

interface TgUpdate {
  update_id: number;
  message?: Record<string, unknown>;
  [key: string]: unknown;
}

@Controller("webhooks/telegram")
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegramService: TelegramConnectorService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(":secret")
  @Public()
  async handleWebhook(
    @Param("secret") secret: string,
    @Body() body: TgUpdate,
  ): Promise<{ ok: boolean }> {
    const connector = await this.prisma.connector.findFirst({ where: { type: "telegram", isEnabled: true } });
    if (!connector) {
      this.logger.warn("No enabled Telegram connector — ignoring webhook.");
      return { ok: true };
    }
    this.telegramService.validateSecret(secret, connector);
    return this.telegramService.processUpdate(body as Parameters<typeof this.telegramService.processUpdate>[0], connector);
  }
}
