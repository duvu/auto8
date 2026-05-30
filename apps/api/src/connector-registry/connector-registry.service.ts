import { Injectable, Logger, NotFoundException, OnModuleInit, UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Connector } from "@prisma/client";

import type { ConnectorSyncSummary, ConnectorTestResult, ConnectorView } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateConnectorDto } from "./dto/create-connector.dto";
import type { UpdateConnectorDto } from "./dto/update-connector.dto";
import { encrypt, decrypt, isEncrypted } from "./crypto.util";

@Injectable()
export class ConnectorRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ConnectorRegistryService.name);

  // Injected optionally by the module to avoid circular deps at bootstrap
  gmailService?: { testConnector(c: Connector): Promise<ConnectorTestResult>; sync(c: Connector): Promise<ConnectorSyncSummary> };
  slackService?: { testConnector(c: Connector): Promise<ConnectorTestResult> };
  outlookService?: { testConnector(c: Connector): Promise<ConnectorTestResult>; sync(c: Connector): Promise<ConnectorSyncSummary> };
  whatsappService?: { testConnector(c: Connector): Promise<ConnectorTestResult> };
  telegramService?: { testConnector(c: Connector): Promise<ConnectorTestResult> };
  zaloService?: { testConnector(c: Connector): Promise<ConnectorTestResult> };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapGmail();
    await this.bootstrapSlack();
    await this.bootstrapOutlook();
    await this.bootstrapReEncrypt();
  }

  private getEncryptionKey(): string | undefined {
    return this.config.get<string>("CREDENTIALS_ENCRYPTION_KEY")?.trim() || undefined;
  }

  private encryptCredentials(credentialsJson: string): string {
    const key = this.getEncryptionKey();
    if (!key) return credentialsJson;
    if (isEncrypted(credentialsJson)) return credentialsJson; // already encrypted
    try {
      return encrypt(credentialsJson, key);
    } catch (e) {
      this.logger.error("Failed to encrypt credentials", e);
      return credentialsJson;
    }
  }

  private decryptCredentials(credentialsJson: string): string {
    const key = this.getEncryptionKey();
    if (!key || !isEncrypted(credentialsJson)) return credentialsJson;
    try {
      return decrypt(credentialsJson, key);
    } catch (e) {
      this.logger.error("Failed to decrypt credentials", e);
      return credentialsJson;
    }
  }

  private async bootstrapReEncrypt(): Promise<void> {
    const key = this.getEncryptionKey();
    if (!key) return; // no key — nothing to re-encrypt

    const connectors = await this.prisma.connector.findMany();
    for (const connector of connectors) {
      if (!isEncrypted(connector.credentialsJson)) {
        const encryptedJson = this.encryptCredentials(connector.credentialsJson);
        await this.prisma.connector.update({
          where: { id: connector.id },
          data: { credentialsJson: encryptedJson },
        });
        this.logger.log(`Re-encrypted credentials for connector ${connector.id}`);
      }
    }
  }

  private async bootstrapGmail(): Promise<void> {
    const clientId = this.config.get<string>("GMAIL_CLIENT_ID")?.trim();
    const clientSecret = this.config.get<string>("GMAIL_CLIENT_SECRET")?.trim();
    const refreshToken = this.config.get<string>("GMAIL_REFRESH_TOKEN")?.trim();
    if (!clientId || !clientSecret || !refreshToken) return;

    const existing = await this.prisma.connector.findFirst({ where: { type: "gmail" } });
    if (existing) return;

    const credentialsJson = this.encryptCredentials(JSON.stringify({
      clientId,
      clientSecret,
      refreshToken,
      searchQuery: this.config.get<string>("GMAIL_SEARCH_QUERY") ?? "is:unread",
      maxResults: String(this.config.get<number>("GMAIL_MAX_RESULTS") ?? 20),
    }));

    await this.prisma.connector.create({
      data: {
        type: "gmail",
        label: "Default Gmail",
        credentialsJson,
      },
    });
    this.logger.log("Bootstrapped Gmail connector from env vars");
  }

  private async bootstrapSlack(): Promise<void> {
    const signingSecret = this.config.get<string>("SLACK_SIGNING_SECRET")?.trim();
    const botToken = this.config.get<string>("SLACK_BOT_TOKEN")?.trim();
    if (!signingSecret || !botToken) return;

    const existing = await this.prisma.connector.findFirst({ where: { type: "slack" } });
    if (existing) return;

    const credentialsJson = this.encryptCredentials(JSON.stringify({ signingSecret, botToken }));

    await this.prisma.connector.create({
      data: {
        type: "slack",
        label: "Default Slack",
        credentialsJson,
      },
    });
    this.logger.log("Bootstrapped Slack connector from env vars");
  }

  private async bootstrapOutlook(): Promise<void> {
    const clientId = this.config.get<string>("OUTLOOK_CLIENT_ID")?.trim();
    const clientSecret = this.config.get<string>("OUTLOOK_CLIENT_SECRET")?.trim();
    const refreshToken = this.config.get<string>("OUTLOOK_REFRESH_TOKEN")?.trim();
    if (!clientId || !clientSecret || !refreshToken) return;

    const existing = await this.prisma.connector.findFirst({ where: { type: "outlook" } });
    if (existing) return;

    const tenantId = this.config.get<string>("OUTLOOK_TENANT_ID", "common");
    const credentialsJson = this.encryptCredentials(
      JSON.stringify({ clientId, clientSecret, refreshToken, tenantId, maxResults: 50, markAsRead: true }),
    );

    await this.prisma.connector.create({
      data: {
        type: "outlook",
        label: "Default Outlook",
        credentialsJson,
      },
    });
    this.logger.log("Bootstrapped Outlook connector from env vars");
  }

  async findAll(): Promise<ConnectorView[]> {
    const connectors = await this.prisma.connector.findMany({
      orderBy: { createdAt: "asc" },
    });
    return connectors.map((c) => this.serialize(c));
  }

  async findAllEnabled(type?: string): Promise<Connector[]> {
    const connectors = await this.prisma.connector.findMany({
      where: {
        isEnabled: true,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    // Decrypt credentials for consumers (e.g., GmailConnectorService)
    return connectors.map((c) => ({
      ...c,
      credentialsJson: this.decryptCredentials(c.credentialsJson),
    }));
  }

  async findOne(id: string): Promise<Connector> {
    const connector = await this.prisma.connector.findUnique({ where: { id } });
    if (!connector) throw new NotFoundException(`Connector ${id} not found`);
    return {
      ...connector,
      credentialsJson: this.decryptCredentials(connector.credentialsJson),
    };
  }

  async create(dto: CreateConnectorDto): Promise<ConnectorView> {
    const credentialsJson = this.encryptCredentials(JSON.stringify(dto.credentials));
    const connector = await this.prisma.connector.create({
      data: {
        type: dto.type,
        label: dto.label,
        credentialsJson,
      },
    });
    return this.serialize(connector);
  }

  async update(id: string, dto: UpdateConnectorDto): Promise<ConnectorView> {
    await this.findOne(id); // 404 if not found
    const updateData: Record<string, unknown> = {};
    if (dto.label !== undefined) updateData["label"] = dto.label;
    if (dto.isEnabled !== undefined) updateData["isEnabled"] = dto.isEnabled;
    if (dto.credentials !== undefined) {
      updateData["credentialsJson"] = this.encryptCredentials(JSON.stringify(dto.credentials));
      updateData["failureCount"] = 0;
      updateData["lastError"] = null;
    }
    const connector = await this.prisma.connector.update({
      where: { id },
      data: updateData,
    });
    return this.serialize(connector);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.connector.delete({ where: { id } });
  }

  async updateHealth(id: string, error?: string): Promise<void> {
    const threshold = this.config.get<number>("CONNECTOR_AUTO_DISABLE_THRESHOLD", 5);
    if (error) {
      const connector = await this.prisma.connector.update({
        where: { id },
        data: {
          lastError: error,
          failureCount: { increment: 1 },
        },
      });
      if (connector.failureCount >= threshold) {
        await this.prisma.connector.update({
          where: { id },
          data: { isEnabled: false },
        });
        this.logger.warn(`Connector ${id} auto-disabled after ${connector.failureCount} consecutive failures`);
      }
    } else {
      await this.prisma.connector.update({
        where: { id },
        data: { lastSyncAt: new Date(), lastError: null, failureCount: 0 },
      });
    }
  }

  async findOneView(id: string): Promise<ConnectorView> {
    const connector = await this.prisma.connector.findUnique({ where: { id } });
    if (!connector) throw new NotFoundException(`Connector ${id} not found`);
    return this.serialize(connector);
  }

  async syncNow(id: string): Promise<ConnectorSyncSummary> {
    const connector = await this.findOne(id);
    if (!connector.isEnabled) {
      throw new UnprocessableEntityException("Connector is disabled.");
    }
    if (connector.type === "slack" || connector.type === "whatsapp" || connector.type === "telegram" || connector.type === "zalo") {
      throw new UnprocessableEntityException(`${connector.type} is push-only and cannot be manually synced.`);
    }
    let syncError: string | undefined;
    let result: ConnectorSyncSummary = { imported: 0, skipped: 0, failed: 0, importedReferences: [], errors: [] };
    try {
      if (connector.type === "gmail" && this.gmailService) {
        result = await this.gmailService.sync(connector);
      } else if (connector.type === "outlook" && this.outlookService) {
        result = await this.outlookService.sync(connector);
      } else {
        throw new Error(`No sync handler for connector type: ${connector.type}`);
      }
    } catch (e) {
      syncError = e instanceof Error ? e.message : String(e);
      result.failed += 1;
      result.errors.push(syncError);
    }
    await this.updateHealth(id, syncError);
    return result;
  }

  async testConnector(id: string): Promise<ConnectorTestResult> {
    const connector = await this.findOne(id);
    try {
      if (connector.type === "gmail" && this.gmailService) {
        return await this.gmailService.testConnector(connector);
      }
      if (connector.type === "slack" && this.slackService) {
        return await this.slackService.testConnector(connector);
      }
      if (connector.type === "outlook" && this.outlookService) {
        return await this.outlookService.testConnector(connector);
      }
      if (connector.type === "whatsapp" && this.whatsappService) {
        return await this.whatsappService.testConnector(connector);
      }
      if (connector.type === "telegram" && this.telegramService) {
        return await this.telegramService.testConnector(connector);
      }
      if (connector.type === "zalo" && this.zaloService) {
        return await this.zaloService.testConnector(connector);
      }
      return { ok: false, error: `No test handler for type: ${connector.type}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private serialize(c: Connector): ConnectorView {
    return {
      id: c.id,
      type: c.type as "gmail" | "slack" | "outlook" | "whatsapp" | "telegram" | "zalo",
      label: c.label,
      isEnabled: c.isEnabled,
      lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
      lastError: c.lastError,
      failureCount: c.failureCount,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
