import { Injectable } from "@nestjs/common";
import { QuoteStatus } from "@prisma/client";

import type { ConnectorStatsView, ResponseTimeResult, RfqVolumePoint, TopCustomerView, WinRateResult } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRfqVolume(workspaceId?: string): Promise<RfqVolumePoint[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const intakes = await this.prisma.rfqIntake.findMany({
      where: {
        receivedAt: { gte: since },
      },
      select: { receivedAt: true, sourceType: true },
      orderBy: { receivedAt: "asc" },
    });

    const map = new Map<string, number>();
    for (const intake of intakes) {
      const key = `${intake.receivedAt.toISOString().slice(0, 10)}:${intake.sourceType}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return Array.from(map.entries()).map(([key, count]) => {
      const [date, sourceType] = key.split(":");
      return { date: date!, sourceType: sourceType!, count };
    });
  }

  async getWinRate(workspaceId?: string): Promise<WinRateResult> {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const events = await this.prisma.quoteStatusEvent.findMany({
      where: {
        status: { in: [QuoteStatus.customer_accepted, QuoteStatus.customer_rejected] },
        createdAt: { gte: since },
      },
      select: { status: true },
    });

    const accepted = events.filter((e) => e.status === QuoteStatus.customer_accepted).length;
    const rejected = events.filter((e) => e.status === QuoteStatus.customer_rejected).length;
    const total = accepted + rejected;
    return { accepted, rejected, winRate: total > 0 ? accepted / total : 0 };
  }

  async getResponseTime(workspaceId?: string): Promise<ResponseTimeResult> {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const intakes = await this.prisma.rfqIntake.findMany({
      where: {
        receivedAt: { gte: since },
        rfq: { quote: { statusEvents: { some: { status: QuoteStatus.pending_approval } } } },
      },
      select: {
        receivedAt: true,
        rfq: {
          select: {
            quote: {
              select: {
                statusEvents: {
                  where: { status: QuoteStatus.pending_approval },
                  orderBy: { createdAt: "asc" },
                  take: 1,
                  select: { createdAt: true },
                },
              },
            },
          },
        },
      },
    });

    const durations: number[] = [];
    for (const intake of intakes) {
      const submitted = intake.rfq?.quote?.statusEvents[0];
      if (submitted) {
        const hours = (submitted.createdAt.getTime() - intake.receivedAt.getTime()) / 3600000;
        durations.push(hours);
      }
    }

    if (durations.length === 0) return { avgHours: 0, p50Hours: 0, p90Hours: 0 };

    durations.sort((a, b) => a - b);
    const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
    const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
    const p90 = durations[Math.floor(durations.length * 0.9)] ?? 0;

    return { avgHours: Math.round(avg * 10) / 10, p50Hours: Math.round(p50 * 10) / 10, p90Hours: Math.round(p90 * 10) / 10 };
  }

  async getTopCustomers(workspaceId?: string): Promise<TopCustomerView[]> {
    const customers = await this.prisma.customer.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      select: {
        id: true,
        companyName: true,
        quotes: {
          select: {
            grandTotal: true,
            statusEvents: {
              select: { status: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const result: TopCustomerView[] = customers.map((c) => {
      const grandTotal = c.quotes.reduce((s, q) => s + (q.grandTotal ?? 0), 0);
      const accepted = c.quotes.flatMap((q) => q.statusEvents).filter((e) => e.status === QuoteStatus.customer_accepted).length;
      const rejected = c.quotes.flatMap((q) => q.statusEvents).filter((e) => e.status === QuoteStatus.customer_rejected).length;
      const total = accepted + rejected;
      return {
        customerId: c.id,
        companyName: c.companyName ?? "",
        totalQuotes: c.quotes.length,
        grandTotal,
        winRate: total > 0 ? accepted / total : 0,
      };
    });

    return result.sort((a, b) => b.grandTotal - a.grandTotal).slice(0, 10);
  }

  async getConnectors(workspaceId?: string): Promise<ConnectorStatsView[]> {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const connectors = await this.prisma.connector.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      select: {
        id: true,
        label: true,
        type: true,
        lastSyncAt: true,
        rfqIntakes: {
          where: { receivedAt: { gte: since30d } },
          select: { id: true },
        },
        ingestionRuns: {
          where: { startedAt: { gte: since7d }, status: "failed" },
          select: { id: true },
        },
      },
    });

    return connectors.map((c) => ({
      connectorId: c.id,
      label: c.label,
      type: c.type,
      intakeCount: c.rfqIntakes.length,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      recentFailures: c.ingestionRuns.length,
    }));
  }
}
