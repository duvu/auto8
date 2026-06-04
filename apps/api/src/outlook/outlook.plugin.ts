import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import { OutlookConnectorService } from "./outlook-connector.service";
import { OutlookModule } from "./outlook.module";
import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";

export const OutlookPlugin: ConnectorPluginManifest = {
  name: "outlook",
  module: OutlookModule,
  connector: {
    type: "outlook",
    serviceToken: OutlookConnectorService,
    fieldDefs: CONNECTOR_FIELD_DEFS["outlook"],
    syncable: true,
  },
};
