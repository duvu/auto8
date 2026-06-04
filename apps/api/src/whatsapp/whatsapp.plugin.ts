import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import { WhatsappConnectorService } from "./whatsapp-connector.service";
import { WhatsappModule } from "./whatsapp.module";
import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";

export const WhatsappPlugin: ConnectorPluginManifest = {
  name: "whatsapp",
  module: WhatsappModule,
  connector: {
    type: "whatsapp",
    serviceToken: WhatsappConnectorService,
    fieldDefs: CONNECTOR_FIELD_DEFS["whatsapp"],
    syncable: false,
  },
};
