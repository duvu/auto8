import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import { GmailConnectorService } from "./gmail.service";
import { GmailModule } from "./gmail.module";
import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";

export const GmailPlugin: ConnectorPluginManifest = {
  name: "gmail",
  module: GmailModule,
  connector: {
    type: "gmail",
    serviceToken: GmailConnectorService,
    fieldDefs: CONNECTOR_FIELD_DEFS["gmail"],
    syncable: true,
  },
};
