import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";
import { ZaloModule } from "./zalo.module";

export const ZaloPlugin: ConnectorPluginManifest = {
  name: "zalo",
  module: ZaloModule,
  connector: {
    type: "zalo",
    serviceToken: "ZaloConnectorService",
    module: ZaloModule,
    fieldDefs: CONNECTOR_FIELD_DEFS["zalo"],
    syncable: false,
  },
};
