import type { Type } from "@nestjs/common";
import type { ConnectorFieldDef, ConnectorType } from "@auto8/shared";

export interface ConnectorPlugin {
  type: ConnectorType;
  serviceToken: string;
  module: Type<unknown>;
  fieldDefs: ConnectorFieldDef[];
  /** true = pull-based (can be manually synced); false = push-only (webhook-driven, no manual sync) */
  syncable: boolean;
}

export interface JobHandlerDeclaration {
  type: string;
  description: string;
}

/** A manifest for a connector plugin (Gmail, Slack, etc.) */
export interface ConnectorPluginManifest {
  name: string;
  module: Type<unknown>;
  connector: ConnectorPlugin;
  jobHandlers?: JobHandlerDeclaration[];
  webhookEvents?: string[];
}

/** A manifest for a non-connector module that declares job handlers or webhook events */
export interface ModulePluginManifest {
  name: string;
  module: Type<unknown>;
  connector?: never;
  jobHandlers?: JobHandlerDeclaration[];
  webhookEvents?: string[];
}

/** Union of all plugin manifest types */
export type PluginManifest = ConnectorPluginManifest | ModulePluginManifest;
