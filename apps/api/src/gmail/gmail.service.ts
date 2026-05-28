import { Injectable, Logger } from "@nestjs/common";
import { google } from "googleapis";

export type GmailMessage = {
  messageId: string;
  threadId: string;
  from: string | null;
  subject: string | null;
  body: string;
  receivedAt: string;
};

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  isConfigured(): boolean {
    return !!(
      process.env.GMAIL_CLIENT_ID?.trim() &&
      process.env.GMAIL_CLIENT_SECRET?.trim() &&
      process.env.GMAIL_REFRESH_TOKEN?.trim()
    );
  }

  private getAuth() {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID!,
      process.env.GMAIL_CLIENT_SECRET!
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!
    });

    return oauth2Client;
  }

  async fetchMessages(query?: string): Promise<GmailMessage[]> {
    const auth = this.getAuth();
    const gmail = google.gmail({ version: "v1", auth });

    const searchQuery = query ?? process.env.GMAIL_SEARCH_QUERY ?? "is:unread";
    const maxResults = parseInt(process.env.GMAIL_MAX_RESULTS ?? "20", 10);

    this.logger.log(`Fetching Gmail messages with query: "${searchQuery}"`);

    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: searchQuery,
      maxResults
    });

    const messageRefs = listResponse.data.messages ?? [];
    if (messageRefs.length === 0) {
      return [];
    }

    const messages: GmailMessage[] = [];

    for (const ref of messageRefs) {
      if (!ref.id) continue;
      try {
        const msgResponse = await gmail.users.messages.get({
          userId: "me",
          id: ref.id,
          format: "full"
        });
        const parsed = parseGmailMessage(msgResponse.data);
        if (parsed) {
          messages.push(parsed);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch message ${ref.id}: ${(error as Error).message}`);
      }
    }

    return messages;
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
  const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

  const body = extractBody(msg.payload);

  return {
    messageId: msg.id,
    threadId: msg.threadId ?? msg.id,
    from,
    subject,
    body,
    receivedAt
  };
}

function extractBody(payload: any): string {
  if (!payload) return "";

  // Prefer text/plain; fall back to text/html snippet
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8").trim();
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = Buffer.from(payload.body.data, "base64").toString("utf8");
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  return "";
}
