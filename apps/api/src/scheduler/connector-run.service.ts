import { HttpException, Injectable, Logger } from "@nestjs/common";

import type { ConnectorSyncSummary } from "../connectors/connector.interface";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ConnectorRunService {
  private readonly logger = new Logger(ConnectorRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runConnector(
    name: string,
    fn: () => Promise<ConnectorSyncSummary>,
    opts: { rethrow?: boolean; connectorId?: string | null; connectorLabel?: string | null } = {},
  ): Promise<void> {
    const startedAt = new Date();
    let summary: ConnectorSyncSummary | null = null;
    let errorMessage: string | null = null;

    try {
      summary = await fn();
    } catch (err) {
      // Re-throw HTTP exceptions so auth/validation errors propagate to the client
      if (err instanceof HttpException) {
        throw err;
      }
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const finishedAt = new Date();

    await this.prisma.ingestionRun.create({
      data: {
        connectorName: name,
        startedAt,
        finishedAt,
        imported: summary?.imported ?? 0,
        skipped: summary?.skipped ?? 0,
        failed: summary?.failed ?? 0,
        status: errorMessage ? "error" : "success",
        errorMessage,
        connectorId: opts.connectorId ?? null,
        connectorLabel: opts.connectorLabel ?? null,
      },
    });

    if (errorMessage) {
      this.logger.error(`Connector '${name}' run failed: ${errorMessage}`);
      if (opts.rethrow) {
        throw new Error(errorMessage);
      }
    } else {
      this.logger.log(
        `Connector '${name}' run complete: imported=${summary!.imported} skipped=${summary!.skipped} failed=${summary!.failed}`
      );
    }
  }
}
