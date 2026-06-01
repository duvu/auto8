import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import { SlackConnectorService } from "./slack-connector.service";
import { SlackModule } from "./slack.module";
import type { PluginManifest } from "../plugin-registry/plugin.interfaces";

export const SlackPlugin: PluginManifest = {
  name: "slack",
  module: SlackModule,
  connector: {
    type: "slack",
    serviceToken: SlackConnectorService,
    fieldDefs: CONNECTOR_FIELD_DEFS["slack"],
    syncable: false,
  },
};
