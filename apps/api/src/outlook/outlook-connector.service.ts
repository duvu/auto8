import * as fs from "fs";
import * as path from "path";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
import type { ConfidentialClientApplication, AuthenticationResult } from "@azure/msal-node";
import type { Connector } from "@prisma/client";

import type { ConnectorService, NormalizedRfqIntake } from "../connectors/connector.interface";
import type { ConnectorSyncSummary, ConnectorTestResult } from "@auto8/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RfqIntakeService } from "../rfqs/rfq-intake.service";

type OutlookCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tenantId?: string;
  maxResults?: number;
  markAsRead?: boolean;
};

type GraphMessage = {
  id: string;
  subject: string | null;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string;
  body?: { content?: string; contentType?: string };
  hasAttachments: boolean;
};

type GraphAttachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  "@odata.type": string;
};

@Injectable()
export class OutlookConnectorService implements ConnectorService {
  private readonly logger = new Logger(OutlookConnectorService.name);

  constructor(
    private readonly rfqIntakeService: RfqIntakeService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return !!(
      this.config.get<string>("OUTLOOK_CLIENT_ID")?.trim() &&
      this.config.get<string>("OUTLOOK_CLIENT_SECRET")?.trim() &&
      this.config.get<string>("OUTLOOK_REFRESH_TOKEN")?.trim()
    );
  }

  private parseCredentials(connector: Connector): OutlookCredentials {
    return JSON.parse(connector.credentialsJson) as OutlookCredentials;
  }

  private async getAccessToken(creds: OutlookCredentials): Promise<string> {
    const { ConfidentialClientApplication } = await import("@azure/msal-node");
    const tenantId = creds.tenantId ?? "common";
    const msalApp: ConfidentialClientApplication = new ConfidentialClientApplication({
      auth: {
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    });

    const result: AuthenticationResult | null = await msalApp.acquireTokenByRefreshToken({
      refreshToken: creds.refreshToken,
      scopes: ["https://graph.microsoft.com/.default"],
    });

    if (!result?.accessToken) {
      throw new Error("Failed to acquire access token from Microsoft");
    }

    return result.accessToken;
  }

  private buildClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  private async fetchMessages(client: Client, maxResults: number): Promise<GraphMessage[]> {
    const response = await client
      .api("/me/mailFolders/inbox/messages")
      .filter("isRead eq false")
      .top(maxResults)
      .select("id,subject,from,receivedDateTime,body,hasAttachments")
      .get() as { value: GraphMessage[] };

    return response.value ?? [];
  }

  private async downloadAttachments(
    client: Client,
    messageId: string,
    storagePath: string,
  ): Promise<Array<{ filename: string; mimeType: string; sizeBytes: number; storagePath: string }>> {
    const response = await client
      .api(`/me/messages/${messageId}/attachments`)
      .select("id,name,contentType,size,@odata.type")
      .get() as { value: GraphAttachment[] };

    const attachments: Array<{ filename: string; mimeType: string; sizeBytes: number; storagePath: string }> = [];
    const baseDir = this.config.get<string>("ATTACHMENT_STORAGE_PATH", "./attachments");

    for (const att of response.value ?? []) {
      // Only handle file attachments (not item attachments)
      if (att["@odata.type"] !== "#microsoft.graph.fileAttachment") continue;
      try {
        // Download raw bytes
        const bytes: unknown = await client
          .api(`/me/messages/${messageId}/attachments/${att.id}/$value`)
          .getStream();

        const safeFilename = att.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = path.join(baseDir, `${messageId}_${safeFilename}`);
        fs.mkdirSync(baseDir, { recursive: true });
        fs.writeFileSync(filePath, Buffer.from(bytes as Buffer));

        attachments.push({
          filename: att.name,
          mimeType: att.contentType,
          sizeBytes: att.size,
          storagePath: filePath,
        });
      } catch (err) {
        this.logger.warn(`Failed to download attachment '${att.name}': ${String(err)}`);
      }
    }

    return attachments;
  }

  private async markAsRead(client: Client, messageId: string): Promise<void> {
    await client.api(`/me/messages/${messageId}`).patch({ isRead: true });
  }

  private normalise(msg: GraphMessage, connector: Connector): NormalizedRfqIntake {
    const senderEmail = msg.from?.emailAddress?.address ?? null;
    const senderName = msg.from?.emailAddress?.name ?? null;
    let body = msg.body?.content ?? "";
    // Strip HTML tags for contentType "html"
    if (msg.body?.contentType === "html") {
      body = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }

    return {
      sourceType: "outlook",
      sourceLabel: connector.label,
      senderEmail,
      senderName,
      subject: msg.subject ?? "(no subject)",
      body,
      receivedAt: msg.receivedDateTime,
      rawPayload: JSON.stringify(msg),
      outlookMessageId: msg.id,
      connectorId: connector.id,
    };
  }

  async sync(connector: Connector): Promise<ConnectorSyncSummary> {
    const summary: ConnectorSyncSummary = {
      imported: 0,
      skipped: 0,
      failed: 0,
      importedReferences: [],
      errors: [],
    };

    const creds = this.parseCredentials(connector);
    const maxResults = creds.maxResults ?? 50;
    const shouldMarkRead = creds.markAsRead !== false;

    let accessToken: string;
    try {
      accessToken = await this.getAccessToken(creds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Outlook token acquisition failed for connector '${connector.label}': ${msg}`);
      summary.failed++;
      summary.errors.push(msg);
      return summary;
    }

    const client = this.buildClient(accessToken);

    let messages: GraphMessage[];
    try {
      messages = await this.fetchMessages(client, maxResults);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Outlook fetch messages failed: ${msg}`);
      summary.failed++;
      summary.errors.push(msg);
      return summary;
    }

    for (const msg of messages) {
      // Deduplication
      const existing = await this.prisma.rfqIntake.findFirst({
        where: { outlookMessageId: msg.id, connectorId: connector.id },
      });
      if (existing) {
        summary.skipped++;
        continue;
      }

      try {
        // Build normalised intake
        const intake = this.normalise(msg, connector);

        // Download attachments if any
        if (msg.hasAttachments) {
          intake.attachments = await this.downloadAttachments(client, msg.id, this.config.get<string>("ATTACHMENT_STORAGE_PATH", "./attachments"));
        }

        const result = await this.rfqIntakeService.classifyAndIntake(intake);
        summary.imported++;
        summary.importedReferences.push(result.reference ?? msg.id);

        if (shouldMarkRead) {
          await this.markAsRead(client, msg.id).catch((e) => {
            this.logger.warn(`Could not mark message ${msg.id} as read: ${String(e)}`);
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to import Outlook message ${msg.id}: ${errMsg}`);
        summary.failed++;
        summary.errors.push(errMsg);
      }
    }

    return summary;
  }

  async testConnector(connector: Connector): Promise<ConnectorTestResult> {
    try {
      const creds = this.parseCredentials(connector);
      const accessToken = await this.getAccessToken(creds);
      const client = this.buildClient(accessToken);
      const profile = await client.api("/me").select("userPrincipalName,displayName").get() as { userPrincipalName?: string; displayName?: string };
      const detail = profile.userPrincipalName ?? profile.displayName ?? "unknown";
      return { ok: true, detail };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: errMsg };
    }
  }
}
