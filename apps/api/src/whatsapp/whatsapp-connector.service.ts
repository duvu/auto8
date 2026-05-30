import { createHmac, timingSafeEqual } from "node:crypto";

import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { Connector } from "@prisma/client";

import type { ConnectorSyncSummary, ConnectorTestResult } from "@auto8/shared";

import type { ConnectorService, NormalizedRfqIntake } from "../connectors/connector.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RfqIntakeService } from "../rfqs/rfq-intake.service";

const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // 16 MB

type RequestHeaders = Record<string, string | string[] | undefined>;

interface MetaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string };
  document?: { id: string; filename?: string; mime_type: string };
  audio?: { id: string };
}

interface MetaContact {
  profile?: { name?: string };
  wa_id?: string;
}

interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata?: { phone_number_id?: string };
      contacts?: MetaContact[];
      messages?: MetaMessage[];
    };
    field: string;
  }>;
}

@Injectable()
export class WhatsappConnectorService implements ConnectorService {
  private readonly logger = new Logger(WhatsappConnectorService.name);

  constructor(
    private readonly rfqIntakeService: RfqIntakeService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return false; // WhatsApp uses DB-only connector credentials
  }

  async sync(_connector: Connector): Promise<ConnectorSyncSummary> {
    this.logger.debug("WhatsApp connector is push-only — sync() is a no-op.");
    return { imported: 0, skipped: 0, failed: 0, importedReferences: [], errors: [] };
  }

  verifyChallenge(connector: Connector, mode: string, token: string, challenge: string): string {
    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const verifyToken = creds["verifyToken"] ?? "";
    if (mode !== "subscribe" || token !== verifyToken) {
      throw new ForbiddenException("WhatsApp webhook verification failed.");
    }
    return challenge;
  }

  verifySignature(headers: RequestHeaders, rawPayload: string, connector: Connector): void {
    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const appSecret = creds["appSecret"] ?? "";
    if (!appSecret) {
      throw new UnauthorizedException("WhatsApp app secret not configured.");
    }

    const sigHeader = this.readHeader(headers, "x-hub-signature-256") ?? "";
    const expected = `sha256=${createHmac("sha256", appSecret).update(rawPayload).digest("hex")}`;

    const a = Buffer.from(sigHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("WhatsApp request signature is invalid.");
    }
  }

  async processWebhook(body: Record<string, unknown>, connector: Connector): Promise<{ ok: boolean }> {
    const entries = (body["entry"] as MetaWebhookEntry[] | undefined) ?? [];

    for (const entry of entries) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const messages = value.messages ?? [];

        for (const msg of messages) {
          await this.processMessage(msg, value.contacts ?? [], connector).catch((err: unknown) => {
            this.logger.warn(`Failed to process WhatsApp message ${msg.id}: ${(err as Error).message}`);
          });
        }
      }
    }

    return { ok: true };
  }

  private async processMessage(msg: MetaMessage, contacts: MetaContact[], connector: Connector): Promise<void> {
    // Dedup
    const existing = await this.prisma.rfqIntake.findFirst({ where: { slackMessageId: msg.id } });
    if (existing) {
      this.logger.debug(`WhatsApp message ${msg.id} already processed, skipping.`);
      return;
    }

    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const accessToken = creds["accessToken"] ?? "";

    const contact = contacts.find((c) => c.wa_id === msg.from);
    const senderName = contact?.profile?.name ?? null;

    let body = "";
    let attachments: NormalizedRfqIntake["attachments"] = [];

    if (msg.type === "text" && msg.text) {
      body = msg.text.body;
    } else if (msg.type === "document" && msg.document) {
      const dl = await this.downloadMedia(msg.document.id, accessToken);
      body = `[Document: ${msg.document.filename ?? msg.document.id}]`;
      attachments = [
        {
          filename: msg.document.filename ?? msg.document.id,
          mimeType: msg.document.mime_type,
          sizeBytes: dl.buffer.length,
          storagePath: `whatsapp/${connector.id}/${msg.id}/${msg.document.filename ?? msg.document.id}`,
        },
      ];
    } else if (msg.type === "image" && msg.image) {
      const dl = await this.downloadMedia(msg.image.id, accessToken);
      body = `[Image attachment]`;
      attachments = [
        {
          filename: `${msg.image.id}.jpg`,
          mimeType: msg.image.mime_type,
          sizeBytes: dl.buffer.length,
          storagePath: `whatsapp/${connector.id}/${msg.id}/${msg.image.id}.jpg`,
        },
      ];
    } else {
      this.logger.debug(`Ignoring WhatsApp message type: ${msg.type}`);
      return;
    }

    if (!body.trim()) return;

    const firstLine = body.split("\n")[0]?.trim() ?? "(no subject)";
    const subject = firstLine.length > 200 ? firstLine.slice(0, 200) + "..." : firstLine || "(no subject)";

    const normalized: NormalizedRfqIntake = {
      sourceType: "whatsapp",
      sourceLabel: connector.label,
      senderEmail: null,
      senderName,
      subject,
      body,
      receivedAt: new Date(parseInt(msg.timestamp, 10) * 1000).toISOString(),
      rawPayload: JSON.stringify({ msg, contacts }),
      slackMessageId: msg.id, // reuse field for WhatsApp message dedup
      connectorId: connector.id,
      attachments,
    };

    await this.rfqIntakeService.classifyAndIntake(normalized);
  }

  private async downloadMedia(mediaId: string, accessToken: string): Promise<{ buffer: Buffer }> {
    // Step 1: get media URL
    const urlRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!urlRes.ok) throw new BadRequestException(`WhatsApp media URL fetch failed: ${urlRes.status}`);
    const urlData = (await urlRes.json()) as { url: string };

    // Step 2: download binary
    const mediaRes = await fetch(urlData.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mediaRes.ok) throw new BadRequestException(`WhatsApp media download failed: ${mediaRes.status}`);

    const arrayBuffer = await mediaRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_MEDIA_BYTES) {
      throw new BadRequestException(`WhatsApp media exceeds 16 MB limit.`);
    }

    return { buffer };
  }

  async testConnector(connector: Connector): Promise<ConnectorTestResult> {
    try {
      const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
      const accessToken = creds["accessToken"] ?? "";
      const phoneNumberId = creds["phoneNumberId"] ?? "";
      if (!accessToken || !phoneNumberId) return { ok: false, error: "accessToken and phoneNumberId required" };

      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as { id?: string; display_phone_number?: string; error?: { message: string } };
      if (res.ok && data.id) {
        return { ok: true, detail: data.display_phone_number ?? data.id };
      }
      return { ok: false, error: data.error?.message ?? "Unknown error" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private readHeader(headers: RequestHeaders, name: string): string | undefined {
    const value = headers[name.toLowerCase()] ?? headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
