import type { ModulePluginManifest } from "../plugin-registry/plugin.interfaces";
import { QuotesModule } from "./quotes.module";

export const QuotesPlugin: ModulePluginManifest = {
  name: "quotes",
  module: QuotesModule,
  jobHandlers: [
    { type: "sheet_export", description: "Export approved quote to Google Sheets" },
  ],
  webhookEvents: ["quote.approved", "quote.sent"],
};
