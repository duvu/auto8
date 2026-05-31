import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";
import { OutlookModule } from "./outlook.module";

export const OutlookPlugin: ConnectorPluginManifest = {
  name: "outlook",
  module: OutlookModule,
  connector: {
    type: "outlook",
    serviceToken: "OutlookConnectorService",
    module: OutlookModule,
    fieldDefs: CONNECTOR_FIELD_DEFS["outlook"],
    syncable: true,
  },
};
