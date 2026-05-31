import type { ModulePluginManifest } from "../plugin-registry/plugin.interfaces";
import { RfqsModule } from "./rfqs.module";

export const RfqsPlugin: ModulePluginManifest = {
  name: "rfqs",
  module: RfqsModule,
  jobHandlers: [
    { type: "rfq_extract", description: "Extract structured items from RFQ intake via LLM" },
    { type: "attachment_parse", description: "Parse attachment text content (PDF/DOCX/XLSX)" },
  ],
  webhookEvents: ["rfq.created"],
};
