import { Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import type { ConnectorType } from "@auto8/shared";

import type { ConnectorPlugin, PluginManifest } from "./plugin.interfaces";

@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly connectorPlugins = new Map<string, ConnectorPlugin>();
  private readonly webhookEvents: string[] = [];
  private readonly manifests: PluginManifest[] = [];

  register(manifests: PluginManifest[]): void {
    for (const manifest of manifests) {
      this.manifests.push(manifest);

      if (manifest.connector) {
        const { type } = manifest.connector;
        if (this.connectorPlugins.has(type)) {
          throw new Error(
            `[PluginRegistry] Duplicate connector type "${type}" declared by "${manifest.name}" — already registered.`,
          );
        }
        this.connectorPlugins.set(type, manifest.connector);
        this.logger.log(`Registered connector plugin: ${type} (${manifest.name})`);
      }

      if (manifest.webhookEvents && manifest.webhookEvents.length > 0) {
        for (const event of manifest.webhookEvents) {
          if (!this.webhookEvents.includes(event)) {
            this.webhookEvents.push(event);
          }
        }
      }
    }
  }

  getConnectorPlugin(type: ConnectorType | string): ConnectorPlugin | undefined {
    return this.connectorPlugins.get(type);
  }

  getAllConnectorPlugins(): ConnectorPlugin[] {
    return Array.from(this.connectorPlugins.values());
  }

  getAllWebhookEvents(): string[] {
    return [...this.webhookEvents];
  }

  getAllManifests(): PluginManifest[] {
    return [...this.manifests];
  }

  validate(moduleRef: ModuleRef): void {
    // Log declared job handlers for discoverability
    for (const manifest of this.manifests) {
      if (manifest.jobHandlers && manifest.jobHandlers.length > 0) {
        for (const jh of manifest.jobHandlers) {
          this.logger.log(`Plugin "${manifest.name}" declares job handler: ${jh.type}`);
        }
      }
    }

    // Warn if connector service token cannot be resolved at startup
    for (const plugin of this.connectorPlugins.values()) {
      try {
        moduleRef.get(plugin.serviceToken, { strict: false });
      } catch {
        this.logger.warn(
          `[PluginRegistry] Connector plugin "${plugin.type}" declares serviceToken "${plugin.serviceToken}" but it cannot be resolved. Check that its module is imported.`,
        );
      }
    }
  }
}
