import type { PluginManifest } from "../plugin-registry/plugin.interfaces";
import { WebhooksModule } from "./webhooks.module";

export const WebhooksPlugin: PluginManifest = {
  name: "webhooks",
  module: WebhooksModule,
};
