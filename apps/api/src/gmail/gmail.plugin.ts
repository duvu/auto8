import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";
import { GmailModule } from "./gmail.module";

export const GmailPlugin: ConnectorPluginManifest = {
  name: "gmail",
  module: GmailModule,
  connector: {
    type: "gmail",
    serviceToken: "GmailConnectorService",
    module: GmailModule,
    fieldDefs: CONNECTOR_FIELD_DEFS["gmail"],
    syncable: true,
  },
};
