import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";
import { AuthModule } from "../auth/auth.module";
import { ConnectorRunsService } from "../scheduler/connector-runs.service";
import { ConnectorRegistryController } from "./connector-registry.controller";
import { ConnectorRegistryService } from "./connector-registry.service";
import { OAuth2Config } from "./oauth2.config";
import { OAuth2ConnectorService } from "./oauth2-connector.service";
import { OAuth2ConnectorController } from "./oauth2-connector.controller";

@Module({
  imports: [PrismaModule, RbacModule, AuthModule],
  providers: [ConnectorRegistryService, ConnectorRunsService, OAuth2Config, OAuth2ConnectorService],
  exports: [ConnectorRegistryService],
  controllers: [ConnectorRegistryController, OAuth2ConnectorController],
})
export class ConnectorRegistryModule {}
