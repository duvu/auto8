import type { ModulePluginManifest } from "../plugin-registry/plugin.interfaces";
import { RfqsModule } from "./rfqs.module";

export const RfqsPlugin: ModulePluginManifest = {
  name: "rfqs",
  module: RfqsModule,
};
