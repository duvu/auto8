import type { ModulePluginManifest } from "../plugin-registry/plugin.interfaces";
import { QuotesModule } from "./quotes.module";

export const QuotesPlugin: ModulePluginManifest = {
  name: "quotes",
  module: QuotesModule,
};
