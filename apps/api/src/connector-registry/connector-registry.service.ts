import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Connector } from "@prisma/client";

import type { ConnectorTestResult, ConnectorView } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateConnectorDto } from "./dto/create-connector.dto";
import type { UpdateConnectorDto } from "./dto/update-connector.dto";

@Injectable()
export class ConnectorRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ConnectorRegistryService.name);

  // Injected optionally by the module to avoid circular deps at bootstrap
  gmailService?: { testConnector(c: Connector): Promise<ConnectorTestResult> };
  slackService?: { testConnector(c: Connector): Promise<ConnectorTestResult> };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapGmail();
    await this.bootstrapSlack();
  }

  private async bootstrapGmail(): Promise<void> {
    const clientId = this.config.get<string>("GMAIL_CLIENT_ID")?.trim();
    const clientSecret = this.config.get<string>("GMAIL_CLIENT_SECRET")?.trim();
    const refreshToken = this.config.get<string>("GMAIL_REFRESH_TOKEN")?.trim();
    if (!clientId || !clientSecret || !refreshToken) return;

    const existing = await this.prisma.connector.findFirst({ where: { type: "gmail" } });
    if (existing) return;

    await this.prisma.connector.create({
      data: {
        type: "gmail",
        label: "Default Gmail",
        credentialsJson: JSON.stringify({
          clientId,
          clientSecret,
          refreshToken,
          searchQuery: this.config.get<string>("GMAIL_SEARCH_QUERY") ?? "is:unread",
          maxResults: String(this.config.get<number>("GMAIL_MAX_RESULTS") ?? 20),
        }),
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

    await this.prisma.connector.create({
      data: {
        type: "slack",
        label: "Default Slack",
        credentialsJson: JSON.stringify({ signingSecret, botToken }),
      },
    });
    this.logger.log("Bootstrapped Slack connector from env vars");
  }

  async findAll(): Promise<ConnectorView[]> {
    const connectors = await this.prisma.connector.findMany({
      orderBy: { createdAt: "asc" },
    });
    return connectors.map(this.serialize);
  }

  async findAllEnabled(type?: string): Promise<Connector[]> {
    return this.prisma.connector.findMany({
      where: {
        isEnabled: true,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(id: string): Promise<Connector> {
    const connector = await this.prisma.connector.findUnique({ where: { id } });
    if (!connector) throw new NotFoundException(`Connector ${id} not found`);
    return connector;
  }

  async create(dto: CreateConnectorDto): Promise<ConnectorView> {
    const connector = await this.prisma.connector.create({
      data: {
        type: dto.type,
        label: dto.label,
        credentialsJson: JSON.stringify(dto.credentials),
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
      updateData["credentialsJson"] = JSON.stringify(dto.credentials);
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

  async testConnector(id: string): Promise<ConnectorTestResult> {
    const connector = await this.findOne(id);
    try {
      if (connector.type === "gmail" && this.gmailService) {
        return await this.gmailService.testConnector(connector);
      }
      if (connector.type === "slack" && this.slackService) {
        return await this.slackService.testConnector(connector);
      }
      return { ok: false, error: `No test handler for type: ${connector.type}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private serialize(c: Connector): ConnectorView {
    return {
      id: c.id,
      type: c.type as "gmail" | "slack",
      label: c.label,
      isEnabled: c.isEnabled,
      lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
      lastError: c.lastError,
      failureCount: c.failureCount,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
