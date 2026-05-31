import type { ModulePluginManifest } from "../plugin-registry/plugin.interfaces";
import { WebhooksModule } from "./webhooks.module";

export const WebhooksPlugin: ModulePluginManifest = {
  name: "webhooks",
  module: WebhooksModule,
  jobHandlers: [
    { type: "webhook_deliver", description: "Deliver outbound webhook payload with HMAC signing" },
  ],
};
