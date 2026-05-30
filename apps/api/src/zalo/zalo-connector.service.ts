import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Connector } from "@prisma/client";

import type { ConnectorSyncSummary, ConnectorTestResult } from "@auto8/shared";

import type { ConnectorService, NormalizedRfqIntake } from "../connectors/connector.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RfqIntakeService } from "../rfqs/rfq-intake.service";
import type { ZaloWebhookPayload } from "./dto/zalo-webhook.dto";

const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB

const HANDLED_EVENTS = new Set(["user_send_text", "user_send_image", "user_send_file"]);

@Injectable()
export class ZaloConnectorService implements ConnectorService {
  private readonly logger = new Logger(ZaloConnectorService.name);

  constructor(
    private readonly rfqIntakeService: RfqIntakeService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return false; // DB-only connector
  }

  async sync(_connector: Connector): Promise<ConnectorSyncSummary> {
    this.logger.debug("Zalo connector is push-only — sync() is a no-op.");
    return { imported: 0, skipped: 0, failed: 0, importedReferences: [], errors: [] };
  }

  verifyChallenge(connector: Connector, incomingToken: string, challenge: string): string {
    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const expected = creds["verifyToken"] ?? "";
    if (!expected || incomingToken !== expected) {
      throw new UnauthorizedException("Zalo verifyToken mismatch.");
    }
    return challenge;
  }

  async processWebhook(connector: Connector, body: ZaloWebhookPayload): Promise<{ ok: boolean }> {
    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const appSecret = creds["appSecret"] ?? "";

    // HMAC validation: mac = HMAC-SHA256(appSecret, JSON.stringify(data without mac field))
    if (body.mac) {
      const { mac, ...data } = body;
      const expected = createHmac("sha256", appSecret).update(JSON.stringify(data)).digest("hex");
      try {
        if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
          throw new UnauthorizedException("Zalo HMAC signature invalid.");
        }
      } catch {
        throw new UnauthorizedException("Zalo HMAC signature invalid.");
      }
    } else {
      throw new UnauthorizedException("Zalo webhook missing mac field.");
    }

    if (!HANDLED_EVENTS.has(body.event_name)) {
      this.logger.debug(`Ignoring Zalo event: ${body.event_name}`);
      return { ok: true };
    }

    await this.processMessage(connector, body, creds["oaAccessToken"]).catch((err: unknown) => {
      this.logger.warn(`Failed to process Zalo message ${body.message.msg_id}: ${(err as Error).message}`);
    });
    return { ok: true };
  }

  private async processMessage(
    connector: Connector,
    body: ZaloWebhookPayload,
    oaAccessToken?: string,
  ): Promise<void> {
    const dedupeKey = `zalo_${connector.id}_${body.message.msg_id}`;
    const existing = await this.prisma.rfqIntake.findFirst({ where: { slackMessageId: dedupeKey } });
    if (existing) {
      this.logger.debug(`Zalo message ${body.message.msg_id} already processed, skipping.`);
      return;
    }

    const senderName = body.sender.display_name ?? body.sender.id ?? null;
    let messageBody = body.message.text ?? "";
    let attachments: NormalizedRfqIntake["attachments"] = [];

    if (body.message.attachments?.length) {
      const att = body.message.attachments[0];
      if (att?.payload.url) {
        try {
          const buf = await this.downloadAttachment(att.payload.url, oaAccessToken);
          const filename = att.payload.name ?? `zalo_attachment_${body.message.msg_id}`;
          const mimeType = att.payload.type ?? "application/octet-stream";
          attachments = [
            {
              filename,
              mimeType,
              sizeBytes: buf.length,
              storagePath: `zalo/${connector.id}/${body.message.msg_id}/${filename}`,
            },
          ];
          if (!messageBody) messageBody = `[Attachment: ${filename}]`;
        } catch (err) {
          this.logger.warn(`Zalo attachment download failed: ${(err as Error).message}`);
        }
      }
    }

    if (!messageBody.trim()) {
      this.logger.debug("Ignoring Zalo message with no text or attachment.");
      return;
    }

    const firstLine = messageBody.split("\n")[0]?.trim() ?? "(no subject)";
    const subject = firstLine.length > 200 ? firstLine.slice(0, 200) + "..." : firstLine || "(no subject)";

    const normalized: NormalizedRfqIntake = {
      sourceType: "zalo",
      sourceLabel: connector.label,
      senderEmail: null,
      senderName,
      subject,
      body: messageBody,
      receivedAt: new Date(body.timestamp).toISOString(),
      rawPayload: JSON.stringify(body),
      slackMessageId: dedupeKey,
      connectorId: connector.id,
      attachments,
    };

    await this.rfqIntakeService.classifyAndIntake(normalized);
  }

  private async downloadAttachment(url: string, oaAccessToken?: string): Promise<Buffer> {
    const headers: Record<string, string> = {};
    if (oaAccessToken) {
      headers["access_token"] = oaAccessToken;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Zalo attachment download failed: ${res.status}`);

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > MAX_MEDIA_BYTES) {
      throw new Error("Zalo attachment exceeds 20 MB limit.");
    }
    return buffer;
  }

  async testConnector(connector: Connector): Promise<ConnectorTestResult> {
    try {
      const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
      const oaAccessToken = creds["oaAccessToken"] ?? "";
      if (!oaAccessToken) {
        return { ok: false, error: "oaAccessToken required for test" };
      }
      const res = await fetch("https://openapi.zalo.me/v3.0/oa/getoa", {
        headers: { access_token: oaAccessToken },
      });
      const data = (await res.json()) as { data?: { name?: string; oa_id?: string }; error?: number; message?: string };
      if (data.data?.oa_id) {
        return { ok: true, detail: data.data.name ?? data.data.oa_id };
      }
      return { ok: false, error: data.message ?? "Zalo OA API returned no oa_id" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
