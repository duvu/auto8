import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";
import { WhatsappModule } from "./whatsapp.module";

export const WhatsappPlugin: ConnectorPluginManifest = {
  name: "whatsapp",
  module: WhatsappModule,
  connector: {
    type: "whatsapp",
    serviceToken: "WhatsappConnectorService",
    module: WhatsappModule,
    fieldDefs: CONNECTOR_FIELD_DEFS["whatsapp"],
    syncable: false,
  },
};
