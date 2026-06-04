import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import { TelegramConnectorService } from "./telegram-connector.service";
import { TelegramModule } from "./telegram.module";
import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";

export const TelegramPlugin: ConnectorPluginManifest = {
  name: "telegram",
  module: TelegramModule,
  connector: {
    type: "telegram",
    serviceToken: TelegramConnectorService,
    fieldDefs: CONNECTOR_FIELD_DEFS["telegram"],
    syncable: false,
  },
};
