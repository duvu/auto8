import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { ConnectorRegistryService } from "../connector-registry/connector-registry.service";
import { GmailConnectorService } from "../gmail/gmail.service";
import { OutlookConnectorService } from "../outlook/outlook-connector.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConnectorRunService } from "./connector-run.service";

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly gmailConnectorService: GmailConnectorService,
    private readonly outlookConnectorService: OutlookConnectorService,
    private readonly prisma: PrismaService,
    private readonly connectorRunService: ConnectorRunService,
    private readonly connectorRegistryService: ConnectorRegistryService,
  ) {}

  @Cron("0 * * * *")
  async runGmail(): Promise<void> {
    // Try DB connectors first
    const dbConnectors = await this.connectorRegistryService.findAllEnabled("gmail");

    if (dbConnectors.length > 0) {
      // Multi-connector path: iterate all enabled Gmail connectors
      for (const connector of dbConnectors) {
        const label = connector.label;
        try {
          await this.connectorRunService.runConnector(
            label,
            () => this.gmailConnectorService.sync(connector),
            { connectorId: connector.id, connectorLabel: connector.label },
          );
          await this.connectorRegistryService.updateHealth(connector.id);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          await this.connectorRegistryService.updateHealth(connector.id, errorMsg);
          this.logger.error(`Connector '${label}' failed: ${errorMsg}`);
        }
      }
      return;
    }

    // Legacy env var fallback: if no DB connectors exist, use env var path
    if (!this.gmailConnectorService.isConfigured()) {
      const now = new Date();
      await this.prisma.ingestionRun.create({
        data: {
          connectorName: "gmail",
          startedAt: now,
          finishedAt: now,
          imported: 0,
          skipped: 0,
          failed: 0,
          status: "error",
          errorMessage: "Gmail connector is not configured.",
        },
      });
      this.logger.warn("Gmail connector is not configured — skipping scheduled run.");
      return;
    }

    await this.connectorRunService.runConnector("gmail", () => this.gmailConnectorService.syncLegacy());
  }

  @Cron("0 * * * *")
  async runOutlook(): Promise<void> {
    // Try DB connectors first
    const dbConnectors = await this.connectorRegistryService.findAllEnabled("outlook");

    if (dbConnectors.length > 0) {
      // Multi-connector path: iterate all enabled Outlook connectors
      for (const connector of dbConnectors) {
        const label = connector.label;
        try {
          await this.connectorRunService.runConnector(
            label,
            () => this.outlookConnectorService.sync(connector),
            { connectorId: connector.id, connectorLabel: connector.label },
          );
          await this.connectorRegistryService.updateHealth(connector.id);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          await this.connectorRegistryService.updateHealth(connector.id, errorMsg);
          this.logger.error(`Outlook connector '${label}' failed: ${errorMsg}`);
        }
      }
      return;
    }

    // Legacy env var fallback
    if (!this.outlookConnectorService.isConfigured()) {
      this.logger.debug("Outlook connector is not configured — skipping scheduled run.");
      return;
    }

    // No DB connectors but env vars configured — not supported for Outlook
    // (Outlook always requires a DB connector record with credentials JSON)
    this.logger.debug("Outlook: no DB connectors found — skipping.");
  }
}
