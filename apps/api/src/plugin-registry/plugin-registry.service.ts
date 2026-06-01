import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import type { ConnectorType } from "@auto8/shared";

import { PLUGIN_MANIFESTS_TOKEN, type ConnectorPlugin, type PluginManifest } from "./plugin.interfaces";

@Injectable()
export class PluginRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly connectorPlugins = new Map<string, ConnectorPlugin>();

  constructor(
    @Inject(PLUGIN_MANIFESTS_TOKEN) private readonly manifests: PluginManifest[],
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    for (const manifest of this.manifests) {
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
    }

    this.validate();
  }

  getConnectorPlugin(type: ConnectorType | string): ConnectorPlugin | undefined {
    return this.connectorPlugins.get(type);
  }

  getAllConnectorPlugins(): ConnectorPlugin[] {
    return Array.from(this.connectorPlugins.values());
  }

  private validate(): void {
    for (const plugin of this.connectorPlugins.values()) {
      try {
        this.moduleRef.get(plugin.serviceToken, { strict: false });
      } catch {
        throw new Error(
          `[PluginRegistry] Connector plugin "${plugin.type}" declares serviceToken "${plugin.serviceToken.name}" but it cannot be resolved from the module context. Ensure its module is imported in PluginRegistryModule.register([...]).`,
        );
      }
    }
  }
}
