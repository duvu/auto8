import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";
import { SlackModule } from "./slack.module";

export const SlackPlugin: ConnectorPluginManifest = {
  name: "slack",
  module: SlackModule,
  connector: {
    type: "slack",
    serviceToken: "SlackConnectorService",
    module: SlackModule,
    fieldDefs: CONNECTOR_FIELD_DEFS["slack"],
    syncable: false,
  },
};
