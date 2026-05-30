"use client";

import { useEffect, useState } from "react";

import type { IngestionMetricsSummary, IngestionRunView } from "@auto8/shared";

import { ConnectorStatsTable } from "../../components/ConnectorStatsTable";
import { IngestionRunsTable } from "../../components/IngestionRunsTable";
import { MetricsStatsCard } from "../../components/MetricsStatsCard";
import { fetchRfqs, getIngestionRuns, getIngestionSummary } from "../../lib/api";
import { WorkspaceShell } from "../../components/workspace-shell";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function MetricsPage() {
  const [summary, setSummary] = useState<IngestionMetricsSummary | null>(null);
  const [runs, setRuns] = useState<IngestionRunView[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [connectorFilter, setConnectorFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const authResult = useRequireAuth();

  useEffect(() => {
    async function load() {
      try {
        const [summaryData, runsData, rfqsData] = await Promise.all([
          getIngestionSummary(),
          getIngestionRuns(),
          fetchRfqs(true),
        ]);
        setSummary(summaryData);
        setRuns(runsData.data);
        setOverdueCount(rfqsData.data.filter((r) => r.slaBreached).length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function applyFilters() {
    try {
      const data = await getIngestionRuns({
        connectorName: connectorFilter || undefined,
        from: fromFilter || undefined,
        to: toFilter || undefined,
      });
      setRuns(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to filter runs");
    }
  }

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  if (loading) return (
    <WorkspaceShell title="Ingestion Metrics" description="" authUser={authResult.user} section="Metrics">
      <div className="p-8 text-gray-500">Loading metrics...</div>
    </WorkspaceShell>
  );

  if (error) return (
    <WorkspaceShell title="Ingestion Metrics" description="" authUser={authResult.user} section="Metrics">
      <div className="p-8 text-red-600">{error}</div>
    </WorkspaceShell>
  );

  const totalImported = summary?.byConnector.reduce((s: number, c) => s + c.totalImported, 0) ?? 0;
  const totalRuns = summary?.byConnector.reduce((s: number, c) => s + c.totalRuns, 0) ?? 0;
  const avgErrorRate = summary && summary.byConnector.length > 0
    ? (summary.byConnector.reduce((s: number, c) => s + c.errorRatePercent, 0) / summary.byConnector.length).toFixed(1)
    : "0";

  return (
    <WorkspaceShell
      title="Ingestion Metrics"
      description="Monitor connector ingestion runs and performance statistics."
      authUser={authResult.user}
      section="Metrics"
    >
      <div className="p-6 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <MetricsStatsCard label="Total Imported (all time)" value={totalImported.toLocaleString()} />
          <MetricsStatsCard label="Total Runs" value={totalRuns.toLocaleString()} />
          <MetricsStatsCard label="Avg Error Rate" value={`${avgErrorRate}%`} />
          <MetricsStatsCard label="Overdue RFQs" value={overdueCount.toString()} />
        </div>

        {/* Per-connector breakdown */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">By Connector</h2>
          <ConnectorStatsTable stats={summary?.byConnector ?? []} />
        </section>

        {/* Run history with filters */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Run History</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              placeholder="Connector name"
              value={connectorFilter}
              onChange={(e) => setConnectorFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-40"
            />
            <input
              type="datetime-local"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
            <input
              type="datetime-local"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
            <button
              onClick={applyFilters}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
            >
              Filter
            </button>
            <button
              onClick={() => {
                setConnectorFilter("");
                setFromFilter("");
                setToFilter("");
                void getIngestionRuns().then((res) => setRuns(res.data));
              }}
              className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
          <IngestionRunsTable runs={runs} />
        </section>
      </div>
    </WorkspaceShell>
  );
}
