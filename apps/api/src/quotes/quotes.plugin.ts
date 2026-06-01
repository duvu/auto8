import type { PluginManifest } from "../plugin-registry/plugin.interfaces";
import { QuotesModule } from "./quotes.module";

export const QuotesPlugin: PluginManifest = {
  name: "quotes",
  module: QuotesModule,
};
