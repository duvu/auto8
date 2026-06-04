import { Inject, Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import type { ConnectorType } from "@auto8/shared";

import {
  PLUGIN_MANIFESTS_TOKEN,
  type ConnectorPlugin,
  type ConnectorPluginManifest,
  type PluginManifest,
} from "./plugin.interfaces";

@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly connectorPlugins = new Map<string, ConnectorPlugin>();
  private moduleRef?: ModuleRef;

  constructor(
    @Inject(PLUGIN_MANIFESTS_TOKEN) private readonly manifests: PluginManifest[],
  ) {}

  setModuleRef(ref: ModuleRef): void {
    this.moduleRef = ref;
  }

  onModuleInit(): void {
    for (const manifest of this.manifests) {
      if ('connector' in manifest) {
        const connectorManifest = manifest as ConnectorPluginManifest;
        const { type } = connectorManifest.connector;
        if (this.connectorPlugins.has(type)) {
          throw new Error(
            `[PluginRegistry] Duplicate connector type "${type}" declared by "${connectorManifest.name}" — already registered.`,
          );
        }
        this.connectorPlugins.set(type, connectorManifest.connector);
        this.logger.log(`Registered connector plugin: ${type} (${connectorManifest.name})`);
      }
    }
  }

  validate(): void {
    for (const plugin of this.connectorPlugins.values()) {
      try {
        this.moduleRef?.get(plugin.serviceToken, { strict: false });
      } catch {
        this.logger.warn(
          `[PluginRegistry] Connector plugin "${plugin.type}" declares serviceToken "${plugin.serviceToken.name}" but it cannot be resolved from the module context. Ensure its module is imported in PluginRegistryModule.register([...]).`,
        );
      }
    }
  }

  getConnectorPlugin(type: ConnectorType | string): ConnectorPlugin | undefined {
    return this.connectorPlugins.get(type);
  }

  getAllConnectorPlugins(): ConnectorPlugin[] {
    return Array.from(this.connectorPlugins.values());
  }
}
