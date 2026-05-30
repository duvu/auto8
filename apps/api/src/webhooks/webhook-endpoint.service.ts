import { createHmac } from "node:crypto";

import { Injectable, Logger, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { encrypt, decrypt, isEncrypted } from "../connector-registry/crypto.util";
import { ConfigService } from "@nestjs/config";
import type { CreateWebhookEndpointDto, UpdateWebhookEndpointDto } from "./dto/webhook-endpoint.dto";

export interface WebhookEndpointView {
  id: string;
  url: string;
  events: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class WebhookEndpointService {
  private readonly logger = new Logger(WebhookEndpointService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey(): string | undefined {
    return this.config.get<string>("CREDENTIALS_ENCRYPTION_KEY")?.trim() || undefined;
  }

  private encryptSecret(secret: string): string {
    const key = this.encryptionKey();
    if (!key) return secret;
    return encrypt(secret, key);
  }

  decryptSecret(encryptedSecret: string): string {
    const key = this.encryptionKey();
    if (!key || !isEncrypted(encryptedSecret)) return encryptedSecret;
    return decrypt(encryptedSecret, key);
  }

  async create(dto: CreateWebhookEndpointDto): Promise<WebhookEndpointView> {
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        url: dto.url,
        secret: this.encryptSecret(dto.secret),
        events: dto.events,
      },
    });
    return this.serialize(endpoint);
  }

  async list(): Promise<WebhookEndpointView[]> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({ orderBy: { createdAt: "asc" } });
    return endpoints.map((e) => this.serialize(e));
  }

  async update(id: string, dto: UpdateWebhookEndpointDto): Promise<WebhookEndpointView> {
    await this.findOne(id);
    const endpoint = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.events !== undefined && { events: dto.events }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      },
    });
    return this.serialize(endpoint);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  async test(id: string): Promise<{ ok: boolean; statusCode?: number; latencyMs?: number; error?: string }> {
    const endpoint = await this.findOne(id);
    const secret = this.decryptSecret(endpoint.secret);
    const payload = JSON.stringify({ event: "ping", timestamp: new Date().toISOString() });
    const sig = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
    const start = Date.now();
    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auto8-Signature-256": sig },
        body: payload,
      });
      return { ok: res.ok, statusCode: res.status, latencyMs: Date.now() - start };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - start };
    }
  }

  async findOne(id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint) throw new NotFoundException(`WebhookEndpoint ${id} not found`);
    return endpoint;
  }

  async findEnabledForEvent(event: string) {
    return this.prisma.webhookEndpoint.findMany({ where: { isEnabled: true, events: { has: event } } });
  }

  private serialize(e: { id: string; url: string; events: string[]; isEnabled: boolean; createdAt: Date; updatedAt: Date }): WebhookEndpointView {
    return {
      id: e.id,
      url: e.url,
      events: e.events,
      isEnabled: e.isEnabled,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }
}
