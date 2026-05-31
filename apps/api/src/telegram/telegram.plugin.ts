import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import type { ConnectorPluginManifest } from "../plugin-registry/plugin.interfaces";
import { TelegramModule } from "./telegram.module";

export const TelegramPlugin: ConnectorPluginManifest = {
  name: "telegram",
  module: TelegramModule,
  connector: {
    type: "telegram",
    serviceToken: "TelegramConnectorService",
    module: TelegramModule,
    fieldDefs: CONNECTOR_FIELD_DEFS["telegram"],
    syncable: false,
  },
};
