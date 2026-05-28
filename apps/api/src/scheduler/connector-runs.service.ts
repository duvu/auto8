import { Injectable } from "@nestjs/common";

import type { IngestionRun } from "@prisma/client";

import type { ConnectorView, IngestionDayCount, IngestionMetricsSummary, IngestionRunStats, IngestionRunView, PaginatedResponse } from "@auto8/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { buildPaginatedResponse } from "../common/utils/paginate";

@Injectable()
export class ConnectorRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRuns(
    params: {
      connectorName?: string;
      connectorId?: string;
      from?: string;
      to?: string;
    } = {},
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<IngestionRunView>> {
    const fromDate = params.from ? new Date(params.from) : undefined;
    const toDate = params.to ? new Date(params.to) : undefined;
    const where = {
      ...(params.connectorId ? { connectorId: params.connectorId } : params.connectorName ? { connectorName: params.connectorName } : {}),
      ...(fromDate && !isNaN(fromDate.getTime()) || toDate && !isNaN((toDate as Date).getTime())
        ? {
            createdAt: {
              ...(fromDate && !isNaN(fromDate.getTime()) ? { gte: fromDate } : {}),
              ...(toDate && !isNaN(toDate.getTime()) ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    const skip = (pagination.page - 1) * pagination.limit;
    const [runs, total] = await Promise.all([
      this.prisma.ingestionRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pagination.limit,
      }),
      this.prisma.ingestionRun.count({ where }),
    ]);

    return buildPaginatedResponse(runs.map((r) => this.serialize(r)), total, pagination);
  }

  async getSummary(): Promise<IngestionMetricsSummary> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allRuns = await this.prisma.ingestionRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    // Per-connector aggregates
    const connectorMap = new Map<string, IngestionRun[]>();
    for (const run of allRuns) {
      const list = connectorMap.get(run.connectorName) ?? [];
      list.push(run);
      connectorMap.set(run.connectorName, list);
    }

    const byConnector: IngestionRunStats[] = [];
    for (const [connectorName, runs] of connectorMap.entries()) {
      const totalRuns = runs.length;
      const totalImported = runs.reduce((s, r) => s + r.imported, 0);
      const totalSkipped = runs.reduce((s, r) => s + r.skipped, 0);
      const totalFailed = runs.reduce((s, r) => s + r.failed, 0);
      const avgDurationMs = totalRuns === 0 ? 0 : Math.round(
        runs.reduce((s, r) => s + (r.finishedAt.getTime() - r.startedAt.getTime()), 0) / totalRuns
      );
      const errorCount = runs.filter((r) => r.status === "error").length;
      const errorRatePercent = totalRuns === 0 ? 0 : Math.round((errorCount / totalRuns) * 10000) / 100;
      const latest = runs[0]; // ordered desc already

      byConnector.push({
        connectorName,
        totalRuns,
        totalImported,
        totalSkipped,
        totalFailed,
        avgDurationMs,
        errorRatePercent,
        lastRunAt: latest ? latest.createdAt.toISOString() : null,
        lastRunStatus: latest ? (latest.status as "success" | "error") : null,
      });
    }

    // Daily import counts (last 30 days, in-memory aggregation)
    const recentRuns = allRuns.filter((r) => r.createdAt >= thirtyDaysAgo);
    const dayMap = new Map<string, number>();
    for (const run of recentRuns) {
      const date = run.createdAt.toISOString().slice(0, 10);
      dayMap.set(date, (dayMap.get(date) ?? 0) + run.imported);
    }

    const dailyImports: IngestionDayCount[] = Array.from(dayMap.entries())
      .map(([date, imported]) => ({ date, imported }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Per-connector health from Connector table
    const dbConnectors = await this.prisma.connector.findMany({ orderBy: { createdAt: "asc" } });
    const connectors: ConnectorView[] = dbConnectors.map((c) => ({
      id: c.id,
      type: c.type as "gmail" | "slack",
      label: c.label,
      isEnabled: c.isEnabled,
      lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
      lastError: c.lastError,
      failureCount: c.failureCount,
      createdAt: c.createdAt.toISOString(),
    }));

    return { byConnector, dailyImports, connectors };
  }

  private serialize(run: IngestionRun): IngestionRunView {
    return {
      id: run.id,
      connectorName: run.connectorName,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt.toISOString(),
      durationMs: run.finishedAt.getTime() - run.startedAt.getTime(),
      imported: run.imported,
      skipped: run.skipped,
      failed: run.failed,
      status: run.status as "success" | "error",
      errorMessage: run.errorMessage,
      createdAt: run.createdAt.toISOString(),
    };
  }
}
