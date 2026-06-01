import type { PluginManifest } from "../plugin-registry/plugin.interfaces";
import { RfqsModule } from "./rfqs.module";

export const RfqsPlugin: PluginManifest = {
  name: "rfqs",
  module: RfqsModule,
};
