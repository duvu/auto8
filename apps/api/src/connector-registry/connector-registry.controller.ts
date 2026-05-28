import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post } from "@nestjs/common";

import type { ConnectorTestResult, ConnectorView } from "@auto8/shared";

import type { UserRole } from "@prisma/client";
import { Roles } from "../rbac/roles.decorator";
import type { CreateConnectorDto } from "./dto/create-connector.dto";
import type { UpdateConnectorDto } from "./dto/update-connector.dto";
import { ConnectorRegistryService } from "./connector-registry.service";

@Controller("connectors")
@Roles("admin" as UserRole)
export class ConnectorRegistryController {
  constructor(private readonly registryService: ConnectorRegistryService) {}

  @Get()
  findAll(): Promise<ConnectorView[]> {
    return this.registryService.findAll();
  }

  @Post()
  create(@Body() dto: CreateConnectorDto): Promise<ConnectorView> {
    return this.registryService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateConnectorDto): Promise<ConnectorView> {
    return this.registryService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string): Promise<void> {
    await this.registryService.remove(id);
  }

  @Post(":id/test")
  async testConnector(@Param("id") id: string): Promise<ConnectorTestResult> {
    return this.registryService.testConnector(id);
  }
}
