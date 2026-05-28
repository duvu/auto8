import { Controller, Get, Param, Query } from "@nestjs/common";

import type { IngestionMetricsSummary } from "@auto8/shared";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { ConnectorRunsService } from "./connector-runs.service";

@Controller("connectors/runs")
export class ConnectorRunsController {
  constructor(private readonly connectorRunsService: ConnectorRunsService) {}

  @Get()
  listRuns(
    @Query("connectorName") connectorName?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    return this.connectorRunsService.listRuns({ connectorName, from, to }, pagination);
  }

  @Get("summary")
  getSummary(): Promise<IngestionMetricsSummary> {
    return this.connectorRunsService.getSummary();
  }

  @Get(":connectorName")
  listRunsByConnector(
    @Param("connectorName") connectorName: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    return this.connectorRunsService.listRuns({ connectorName }, pagination);
  }
}
