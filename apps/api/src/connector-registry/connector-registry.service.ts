import { Injectable, Logger, NotFoundException, OnModuleInit, UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import type { Connector } from "@prisma/client";

import type { ConnectorSyncSummary, ConnectorTestResult, ConnectorType, ConnectorView } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";
import { PluginRegistryService } from "../plugin-registry/plugin-registry.service";
import type { ConnectorService } from "../connectors/connector.interface";
import type { CreateConnectorDto } from "./dto/create-connector.dto";
import type { UpdateConnectorDto } from "./dto/update-connector.dto";
import { encrypt, decrypt, isEncrypted } from "./crypto.util";

@Injectable()
export class ConnectorRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ConnectorRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pluginRegistry: PluginRegistryService,
    private readonly moduleRef: ModuleRef,
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

  async findAll(workspaceId?: string): Promise<ConnectorView[]> {
    const connectors = await this.prisma.connector.findMany({
      where: workspaceId ? { workspaceId } : undefined,
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

  async create(dto: CreateConnectorDto, workspaceId = "default"): Promise<ConnectorView> {
    const credentialsJson = this.encryptCredentials(JSON.stringify(dto.credentials));
    const connector = await this.prisma.connector.create({
      data: {
        type: dto.type,
        label: dto.label,
        credentialsJson,
        workspaceId,
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
    const plugin = this.pluginRegistry.getConnectorPlugin(connector.type);
    if (plugin && !plugin.syncable) {
      throw new UnprocessableEntityException(`${connector.type} is push-only and cannot be manually synced.`);
    }
    let syncError: string | undefined;
    let result: ConnectorSyncSummary = { imported: 0, skipped: 0, failed: 0, importedReferences: [], errors: [] };
    try {
      const service = this.resolveConnectorService(connector.type);
      if (!service) {
        throw new Error(`No sync handler for connector type: ${connector.type}`);
      }
      result = await service.sync(connector);
    } catch (e) {
      syncError = e instanceof Error ? e.message : String(e);
      result.failed += 1;
      result.errors.push(syncError);
    }
    await this.updateHealth(id, syncError);
    return result;
  }

  async testCredentials(type: string, credentials: Record<string, string>): Promise<ConnectorTestResult> {
    const transient = {
      id: "transient",
      type,
      label: "transient",
      credentialsJson: JSON.stringify(credentials),
      isEnabled: true,
      lastSyncAt: null,
      lastError: null,
      failureCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as import("@prisma/client").Connector;
    try {
      const service = this.resolveConnectorService(type);
      if (!service) return { ok: false, error: `No test handler for type: ${type}` };
      return await service.testConnector(transient);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async testConnector(id: string): Promise<ConnectorTestResult> {
    const connector = await this.findOne(id);
    try {
      const service = this.resolveConnectorService(connector.type);
      if (!service) return { ok: false, error: `No test handler for type: ${connector.type}` };
      return await service.testConnector(connector);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private resolveConnectorService(type: string): ConnectorService | undefined {
    const plugin = this.pluginRegistry.getConnectorPlugin(type);
    if (!plugin) return undefined;
    try {
      return this.moduleRef.get<ConnectorService>(plugin.serviceToken, { strict: false });
    } catch {
      this.logger.warn(`Could not resolve service for connector type "${type}" (token: ${plugin.serviceToken})`);
      return undefined;
    }
  }

  private serialize(c: Connector): ConnectorView {
    return {
      id: c.id,
      type: c.type as ConnectorType,
      label: c.label,
      isEnabled: c.isEnabled,
      lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
      lastError: c.lastError,
      failureCount: c.failureCount,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
