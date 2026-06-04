import type { Type } from "@nestjs/common";
import type { ConnectorFieldDef, ConnectorType } from "@auto8/shared";

export const PLUGIN_MANIFESTS_TOKEN = "PLUGIN_MANIFESTS_TOKEN";

export interface ConnectorPlugin {
  type: ConnectorType;
  serviceToken: Type<unknown>;
  fieldDefs: ConnectorFieldDef[];
  /** true = pull-based (can be manually synced); false = push-only (webhook-driven, no manual sync) */
  syncable: boolean;
}

export interface ConnectorPluginManifest {
  name: string;
  module: Type<unknown>;
  connector: ConnectorPlugin;
}

export interface ModulePluginManifest {
  name: string;
  module: Type<unknown>;
}

export type PluginManifest = ConnectorPluginManifest | ModulePluginManifest;
