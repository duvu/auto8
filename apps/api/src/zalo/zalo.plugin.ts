import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import { ZaloConnectorService } from "./zalo-connector.service";
import { ZaloModule } from "./zalo.module";
import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";

export const ZaloPlugin: ConnectorPluginManifest = {
  name: "zalo",
  module: ZaloModule,
  connector: {
    type: "zalo",
    serviceToken: ZaloConnectorService,
    fieldDefs: CONNECTOR_FIELD_DEFS["zalo"],
    syncable: false,
  },
};
