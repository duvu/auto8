import { Injectable, Logger } from "@nestjs/common";
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

import { ConfigService } from "@nestjs/config";
import type { Connector } from "@prisma/client";

import type { ConnectorService, NormalizedRfqIntake } from "../connectors/connector.interface";
import type { ConnectorTestResult } from "@auto8/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RfqIntakeService } from "../rfqs/rfq-intake.service";

export type GmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

export type GmailMessage = {
  messageId: string;
  threadId: string;
  from: string | null;
  subject: string | null;
  body: string;
  receivedAt: string;
  attachments: GmailAttachment[];
};

export type GmailSyncSummary = {
  imported: number;
  skipped: number;
  failed: number;
  importedReferences: string[];
  errors: string[];
};

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const BATCH_CONCURRENCY = 5;

@Injectable()
export class GmailConnectorService implements ConnectorService {
  private readonly logger = new Logger(GmailConnectorService.name);

  constructor(
    private readonly rfqIntakeService: RfqIntakeService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  isConfigured(): boolean {
    return !!(
      this.config.get<string>("GMAIL_CLIENT_ID")?.trim() &&
      this.config.get<string>("GMAIL_CLIENT_SECRET")?.trim() &&
      this.config.get<string>("GMAIL_REFRESH_TOKEN")?.trim()
    );
  }

  async sync(query?: string, connector?: Connector): Promise<GmailSyncSummary> {
    const summary: GmailSyncSummary = { imported: 0, skipped: 0, failed: 0, importedReferences: [], errors: [] };

    if (connector) {
      // Multi-connector path: use connector's credentials
      return this.syncWithConnector(query, connector, summary);
    }

    if (!this.isConfigured()) {
      throw new Error("Gmail connector is not configured.");
    }

    const messages = await this.fetchMessages(query);
    const gmail = this.getGmailClient();

    for (const msg of messages) {
      try {
        const existing = await this.prisma.rfqIntake.findFirst({
          where: { gmailMessageId: msg.messageId, connectorId: null },
        });
        if (existing) {
          summary.skipped++;
          continue;
        }

        const { fromEmail, fromName } = parseFromHeader(msg.from ?? "");
        const subject = msg.subject?.trim() || "(no subject)";
        const body = msg.body?.trim() || "(empty)";

        if (!fromEmail) {
          const errorMsg = `Message ${msg.messageId}: no valid sender email`;
          this.logger.warn(errorMsg);
          summary.errors.push(errorMsg);
          summary.failed++;
          continue;
        }

        const savedAttachments = await this.downloadAttachments(gmail, msg);

        const intake: NormalizedRfqIntake = {
          sourceType: "email",
          sourceLabel: "Gmail",
          senderEmail: fromEmail,
          senderName: fromName,
          subject,
          body,
          receivedAt: msg.receivedAt,
          rawPayload: JSON.stringify(msg),
          gmailMessageId: msg.messageId,
          gmailThreadId: msg.threadId,
          attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
        };

        const detail = await this.rfqIntakeService.classifyAndIntake(intake);
        summary.imported++;
        summary.importedReferences.push(detail.reference);

        await this.markAsRead(gmail, msg.messageId);
      } catch (error) {
        const errorMsg = `Message ${msg.messageId}: ${(error as Error).message}`;
        this.logger.error(errorMsg);
        summary.errors.push(errorMsg);
        summary.failed++;
      }
    }

    return summary;
  }

  private async syncWithConnector(query: string | undefined, connector: Connector, summary: GmailSyncSummary): Promise<GmailSyncSummary> {
    const gmail = this.getClientForConnector(connector);
    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const searchQuery = query ?? creds["searchQuery"] ?? "is:unread";
    const maxResults = parseInt(creds["maxResults"] ?? "20", 10);
    const messages = await this.fetchMessagesWithClient(gmail, searchQuery, maxResults);

    for (const msg of messages) {
      try {
        const existing = await this.prisma.rfqIntake.findFirst({
          where: { gmailMessageId: msg.messageId, connectorId: connector.id },
        });
        if (existing) {
          summary.skipped++;
          continue;
        }

        const { fromEmail, fromName } = parseFromHeader(msg.from ?? "");
        const subject = msg.subject?.trim() || "(no subject)";
        const body = msg.body?.trim() || "(empty)";

        if (!fromEmail) {
          const errorMsg = `Message ${msg.messageId}: no valid sender email`;
          this.logger.warn(errorMsg);
          summary.errors.push(errorMsg);
          summary.failed++;
          continue;
        }

        const savedAttachments = await this.downloadAttachments(gmail, msg);

        const intake: NormalizedRfqIntake = {
          sourceType: "email",
          sourceLabel: connector.label,
          senderEmail: fromEmail,
          senderName: fromName,
          subject,
          body,
          receivedAt: msg.receivedAt,
          rawPayload: JSON.stringify(msg),
          gmailMessageId: msg.messageId,
          gmailThreadId: msg.threadId,
          connectorId: connector.id,
          attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
        };

        const detail = await this.rfqIntakeService.classifyAndIntake(intake);
        summary.imported++;
        summary.importedReferences.push(detail.reference);

        await this.markAsRead(gmail, msg.messageId);
      } catch (error) {
        const errorMsg = `Message ${msg.messageId}: ${(error as Error).message}`;
        this.logger.error(errorMsg);
        summary.errors.push(errorMsg);
        summary.failed++;
      }
    }

    return summary;
  }

  async testConnector(connector: Connector): Promise<ConnectorTestResult> {
    try {
      const gmail = this.getClientForConnector(connector);
      const profile = await gmail.users.getProfile({ userId: "me" });
      return { ok: true, detail: profile.data.emailAddress ?? "unknown" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private getClientForConnector(connector: Connector): ReturnType<typeof google.gmail> {
    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const oauth2Client = new google.auth.OAuth2(creds["clientId"], creds["clientSecret"]);
    oauth2Client.setCredentials({ refresh_token: creds["refreshToken"] });
    return google.gmail({ version: "v1", auth: oauth2Client });
  }

  private async downloadAttachments(
    gmail: ReturnType<typeof google.gmail>,
    msg: GmailMessage
  ): Promise<Array<{ filename: string; mimeType: string; sizeBytes: number; storagePath: string }>> {
    const savedAttachments: Array<{ filename: string; mimeType: string; sizeBytes: number; storagePath: string }> = [];
    const storagePath = this.config.get<string>("ATTACHMENT_STORAGE_PATH") ?? "./attachments";
    if (msg.attachments.length > 0 && storagePath) {
      fs.mkdirSync(storagePath, { recursive: true });
      for (const att of msg.attachments) {
        try {
          const attData = await this.withRetry(() =>
            gmail.users.messages.attachments.get({
              userId: "me",
              messageId: msg.messageId,
              id: att.attachmentId,
            })
          );
          if (attData.data.data) {
            const buffer = Buffer.from(attData.data.data, "base64");
            const safeFilename = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
            const filePath = path.join(storagePath, `${msg.messageId}_${safeFilename}`);
            fs.writeFileSync(filePath, buffer);
            savedAttachments.push({
              filename: att.filename,
              mimeType: att.mimeType,
              sizeBytes: att.size,
              storagePath: filePath,
            });
          }
        } catch (attErr) {
          this.logger.warn(`Failed to download attachment ${att.filename}: ${(attErr as Error).message}`);
        }
      }
    }
    return savedAttachments;
  }

  private getAuth() {
    const oauth2Client = new google.auth.OAuth2(
      this.config.get<string>("GMAIL_CLIENT_ID")!,
      this.config.get<string>("GMAIL_CLIENT_SECRET")!
    );

    oauth2Client.setCredentials({
      refresh_token: this.config.get<string>("GMAIL_REFRESH_TOKEN")!
    });

    return oauth2Client;
  }

  private getGmailClient() {
    const auth = this.getAuth();
    return google.gmail({ version: "v1", auth });
  }

  async fetchMessages(query?: string): Promise<GmailMessage[]> {
    const gmail = this.getGmailClient();
    const searchQuery = query ?? this.config.get<string>("GMAIL_SEARCH_QUERY") ?? "is:unread";
    const maxResults = parseInt(this.config.get<string>("GMAIL_MAX_RESULTS") ?? "20", 10);
    return this.fetchMessagesWithClient(gmail, searchQuery, maxResults);
  }

  private async fetchMessagesWithClient(
    gmail: ReturnType<typeof google.gmail>,
    searchQuery: string,
    maxResults: number,
  ): Promise<GmailMessage[]> {
    this.logger.log(`Fetching Gmail messages with query: "${searchQuery}"`);
    const allMessageRefs: Array<{ id: string }> = [];
    let pageToken: string | undefined;

    do {
      const listResponse = await this.withRetry(() =>
        gmail.users.messages.list({
          userId: "me",
          q: searchQuery,
          maxResults: Math.min(maxResults - allMessageRefs.length, 100),
          pageToken
        })
      );

      const messageRefs = listResponse.data.messages ?? [];
      for (const ref of messageRefs) {
        if (ref.id) {
          allMessageRefs.push({ id: ref.id });
        }
      }

      pageToken = listResponse.data.nextPageToken ?? undefined;
    } while (pageToken && allMessageRefs.length < maxResults);

    if (allMessageRefs.length === 0) {
      return [];
    }

    this.logger.log(`Found ${allMessageRefs.length} message(s) to fetch`);

    // Fetch messages in parallel batches
    const messages: GmailMessage[] = [];

    for (let i = 0; i < allMessageRefs.length; i += BATCH_CONCURRENCY) {
      const batch = allMessageRefs.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((ref) =>
          this.withRetry(() =>
            gmail.users.messages.get({
              userId: "me",
              id: ref.id,
              format: "full"
            })
          )
        )
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          const parsed = parseGmailMessage(result.value.data);
          if (parsed) {
            messages.push(parsed);
          }
        } else {
          const refId = batch[j].id;
          this.logger.warn(`Failed to fetch message ${refId}: ${result.reason?.message ?? "unknown error"}`);
        }
      }
    }

    return messages;
  }

  private async markAsRead(gmail: ReturnType<typeof google.gmail>, messageId: string): Promise<void> {
    try {
      await this.withRetry(() =>
        gmail.users.messages.modify({
          userId: "me",
          id: messageId,
          requestBody: {
            removeLabelIds: ["UNREAD"]
          }
        })
      );
    } catch (error) {
      // Non-critical: log but don't fail the import
      this.logger.warn(`Failed to mark message ${messageId} as read: ${(error as Error).message}`);
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const statusCode = (error as any)?.response?.status ?? (error as any)?.code;

        // Don't retry on 4xx errors (except 429 rate limit)
        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          throw error;
        }

        if (attempt < MAX_RETRIES - 1) {
          const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          this.logger.debug(`Retry ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms`);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    throw lastError;
  }
}

function parseGmailMessage(msg: any): GmailMessage | null {
  if (!msg?.id) return null;

  const headers: Record<string, string> = {};
  for (const header of msg.payload?.headers ?? []) {
    if (header.name && header.value) {
      headers[header.name.toLowerCase()] = header.value;
    }
  }

  const from = headers["from"] ?? null;
  const subject = headers["subject"] ?? null;
  const dateHeader = headers["date"];
  const receivedAt = dateHeader ? safeParseDate(dateHeader) : new Date().toISOString();

  const body = extractBody(msg.payload);
  const attachments = extractAttachments(msg.payload);

  return {
    messageId: msg.id,
    threadId: msg.threadId ?? msg.id,
    from,
    subject,
    body,
    receivedAt,
    attachments
  };
}

function safeParseDate(dateStr: string): string {
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString();
  }
  return new Date(parsed).toISOString();
}

function extractBody(payload: any): string {
  if (!payload) return "";

  // Prefer text/plain in multipart/alternative
  if (payload.mimeType?.startsWith("multipart/") && payload.parts) {
    // First pass: look for text/plain
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf8").trim();
      }
    }
    // Second pass: look for text/html
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = Buffer.from(part.body.data, "base64").toString("utf8");
        return stripHtml(html);
      }
    }
    // Third pass: recurse into nested multipart
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8").trim();
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = Buffer.from(payload.body.data, "base64").toString("utf8");
    return stripHtml(html);
  }

  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAttachments(payload: any): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];
  collectAttachments(payload, attachments);
  return attachments;
}

function collectAttachments(part: any, result: GmailAttachment[]): void {
  if (!part) return;

  if (part.filename && part.body?.attachmentId) {
    result.push({
      filename: part.filename,
      mimeType: part.mimeType ?? "application/octet-stream",
      size: part.body.size ?? 0,
      attachmentId: part.body.attachmentId
    });
  }

  if (part.parts) {
    for (const child of part.parts) {
      collectAttachments(child, result);
    }
  }
}

function parseFromHeader(from: string): { fromEmail: string | null; fromName: string | null } {
  if (!from) return { fromEmail: null, fromName: null };

  const angleMatch = from.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angleMatch) {
    const fromName = angleMatch[1].replace(/^["']|["']$/g, "").trim() || null;
    const fromEmail = angleMatch[2].trim().toLowerCase() || null;
    return { fromEmail, fromName };
  }

  const bare = from.trim().toLowerCase();
  return { fromEmail: bare || null, fromName: null };
}
