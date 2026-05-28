import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, UnprocessableEntityException } from "@nestjs/common";

import type { ConnectorSyncSummary, ConnectorTestResult, ConnectorView, PaginatedResponse, IngestionRunView } from "@auto8/shared";
import type { UserRole } from "@prisma/client";
import { Roles } from "../rbac/roles.decorator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { ConnectorRunsService } from "../scheduler/connector-runs.service";
import type { CreateConnectorDto } from "./dto/create-connector.dto";
import type { UpdateConnectorDto } from "./dto/update-connector.dto";
import { ConnectorRegistryService } from "./connector-registry.service";

@Controller("connectors")
@Roles("admin" as UserRole)
export class ConnectorRegistryController {
  constructor(
    private readonly registryService: ConnectorRegistryService,
    private readonly connectorRunsService: ConnectorRunsService,
  ) {}

  @Get()
  findAll(): Promise<ConnectorView[]> {
    return this.registryService.findAll();
  }

  @Get(":id")
  @Roles() // any authenticated user
  findOne(@Param("id") id: string): Promise<ConnectorView> {
    return this.registryService.findOneView(id);
  }

  @Get(":id/runs")
  @Roles() // any authenticated user
  getConnectorRuns(
    @Param("id") id: string,
    @Query() pagination?: PaginationQueryDto,
  ): Promise<PaginatedResponse<IngestionRunView>> {
    return this.connectorRunsService.listRuns({ connectorId: id }, pagination);
  }

  @Post(":id/sync")
  syncNow(@Param("id") id: string): Promise<ConnectorSyncSummary> {
    return this.registryService.syncNow(id);
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
