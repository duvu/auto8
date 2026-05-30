import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { Connector } from "@prisma/client";

import type { ConnectorSyncSummary, ConnectorTestResult } from "@auto8/shared";

import type { ConnectorService, NormalizedRfqIntake } from "../connectors/connector.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RfqIntakeService } from "../rfqs/rfq-intake.service";

const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TgDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  date: number;
  text?: string;
  caption?: string;
  document?: TgDocument;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

@Injectable()
export class TelegramConnectorService implements ConnectorService {
  private readonly logger = new Logger(TelegramConnectorService.name);

  constructor(
    private readonly rfqIntakeService: RfqIntakeService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return false; // DB-only connector
  }

  async sync(_connector: Connector): Promise<ConnectorSyncSummary> {
    this.logger.debug("Telegram connector is push-only — sync() is a no-op.");
    return { imported: 0, skipped: 0, failed: 0, importedReferences: [], errors: [] };
  }

  validateSecret(pathSecret: string, connector: Connector): void {
    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const expected = creds["webhookSecret"] ?? "";
    if (!expected || pathSecret !== expected) {
      throw new UnauthorizedException("Telegram webhook secret is invalid.");
    }
  }

  async processUpdate(update: TgUpdate, connector: Connector): Promise<{ ok: boolean }> {
    if (!update.message) {
      // Ignore non-message updates (callback_query, inline, etc.)
      return { ok: true };
    }
    await this.processMessage(update.message, connector).catch((err: unknown) => {
      this.logger.warn(`Failed to process Telegram message ${update.message!.message_id}: ${(err as Error).message}`);
    });
    return { ok: true };
  }

  private async processMessage(msg: TgMessage, connector: Connector): Promise<void> {
    const dedupeKey = `tg_${connector.id}_${msg.message_id}`;
    const existing = await this.prisma.rfqIntake.findFirst({ where: { slackMessageId: dedupeKey } });
    if (existing) {
      this.logger.debug(`Telegram message ${msg.message_id} already processed, skipping.`);
      return;
    }

    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const botToken = creds["botToken"] ?? "";

    const senderName = msg.from
      ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") || msg.from.username || null
      : null;

    let body = "";
    let attachments: NormalizedRfqIntake["attachments"] = [];

    if (msg.text) {
      body = msg.text;
    } else if (msg.document) {
      const buffer = await this.downloadDocument(msg.document.file_id, botToken);
      body = msg.caption || `[Document: ${msg.document.file_name ?? msg.document.file_id}]`;
      attachments = [
        {
          filename: msg.document.file_name ?? msg.document.file_id,
          mimeType: msg.document.mime_type ?? "application/octet-stream",
          sizeBytes: buffer.length,
          storagePath: `telegram/${connector.id}/${msg.message_id}/${msg.document.file_name ?? msg.document.file_id}`,
        },
      ];
    } else if (msg.caption) {
      body = msg.caption;
    } else {
      this.logger.debug(`Ignoring Telegram message with no text or document.`);
      return;
    }

    if (!body.trim()) return;

    const firstLine = body.split("\n")[0]?.trim() ?? "(no subject)";
    const subject = firstLine.length > 200 ? firstLine.slice(0, 200) + "..." : firstLine || "(no subject)";

    const normalized: NormalizedRfqIntake = {
      sourceType: "telegram",
      sourceLabel: connector.label,
      senderEmail: null,
      senderName,
      subject,
      body,
      receivedAt: new Date(msg.date * 1000).toISOString(),
      rawPayload: JSON.stringify(msg),
      slackMessageId: dedupeKey, // reuse field for dedup
      connectorId: connector.id,
      attachments,
    };

    await this.rfqIntakeService.classifyAndIntake(normalized);
  }

  private async downloadDocument(fileId: string, botToken: string): Promise<Buffer> {
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    if (!fileRes.ok) throw new BadRequestException(`Telegram getFile failed: ${fileRes.status}`);
    const fileData = (await fileRes.json()) as { ok: boolean; result?: { file_path: string } };
    if (!fileData.ok || !fileData.result?.file_path) {
      throw new BadRequestException("Telegram getFile returned no file_path.");
    }
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
    const dlRes = await fetch(downloadUrl);
    if (!dlRes.ok) throw new BadRequestException(`Telegram file download failed: ${dlRes.status}`);

    const arrayBuffer = await dlRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > MAX_MEDIA_BYTES) {
      throw new BadRequestException("Telegram document exceeds 20 MB limit.");
    }
    return buffer;
  }

  async testConnector(connector: Connector): Promise<ConnectorTestResult> {
    try {
      const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
      const botToken = creds["botToken"] ?? "";
      if (!botToken) return { ok: false, error: "botToken required" };

      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = (await res.json()) as { ok: boolean; result?: { username?: string; first_name?: string }; description?: string };
      if (data.ok && data.result) {
        return { ok: true, detail: data.result.username ?? data.result.first_name ?? "unknown" };
      }
      return { ok: false, error: data.description ?? "Unknown error" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
