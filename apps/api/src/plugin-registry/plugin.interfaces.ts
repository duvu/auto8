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

export interface PluginManifest {
  name: string;
  module: Type<unknown>;
  connector?: ConnectorPlugin;
}
