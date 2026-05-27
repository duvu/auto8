import { Global, Module } from "@nestjs/common";

import { ConnectorRunService } from "./connector-run.service";

@Global()
@Module({
  providers: [ConnectorRunService],
  exports: [ConnectorRunService],
})
export class ConnectorRunModule {}
