"use client";

import { useEffect, useState } from "react";

import type {
  ConnectorStatsView,
  ResponseTimeResult,
  RfqVolumePoint,
  TopCustomerView,
  WinRateResult,
} from "../../lib/api";
import {
  getAnalyticsConnectors,
  getAnalyticsResponseTime,
  getAnalyticsRfqVolume,
  getAnalyticsTopCustomers,
  getAnalyticsWinRate,
} from "../../lib/api";
import { useRequireAuth } from "../../lib/use-require-auth";
import { AppShell } from "../../components/app-shell";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function formatCurrency(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default function AnalyticsPage() {
  const authResult = useRequireAuth();

  const [volume, setVolume] = useState<RfqVolumePoint[]>([]);
  const [winRate, setWinRate] = useState<WinRateResult | null>(null);
  const [responseTime, setResponseTime] = useState<ResponseTimeResult | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomerView[]>([]);
  const [connectors, setConnectors] = useState<ConnectorStatsView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [vol, wr, rt, tc, cs] = await Promise.all([
        getAnalyticsRfqVolume(),
        getAnalyticsWinRate(),
        getAnalyticsResponseTime(),
        getAnalyticsTopCustomers(),
        getAnalyticsConnectors(),
      ]);
      setVolume(vol);
      setWinRate(wr);
      setResponseTime(rt);
      setTopCustomers(tc);
      setConnectors(cs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <AppShell title="Analytics">
      {loading && <div className="p-6 text-gray-500">Loading...</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="space-y-8 max-w-5xl">
          <section>
            <h2 className="text-lg font-semibold mb-3">Win Rate</h2>
            {winRate && (
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Accepted" value={String(winRate.accepted)} />
                <StatCard label="Rejected" value={String(winRate.rejected)} />
                <StatCard label="Win Rate" value={`${(winRate.winRate * 100).toFixed(1)}%`} />
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">Response Time</h2>
            {responseTime && (
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Average" value={formatHours(responseTime.avgHours)} />
                <StatCard label="Median (p50)" value={formatHours(responseTime.p50Hours)} />
                <StatCard label="p90" value={formatHours(responseTime.p90Hours)} />
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">RFQ Volume (last 30 days)</h2>
            <div className="bg-white border rounded p-4 overflow-x-auto">
              {volume.length === 0 ? (
                <p className="text-sm text-gray-500">No data</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="text-left font-medium text-gray-500 pb-2 border-b pr-4">Date</th>
                      <th className="text-left font-medium text-gray-500 pb-2 border-b pr-4">Source</th>
                      <th className="text-right font-medium text-gray-500 pb-2 border-b">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volume.map((v, i) => (
                      <tr key={i}>
                        <td className="py-1 border-b pr-4">{v.date}</td>
                        <td className="py-1 border-b pr-4">{v.sourceType}</td>
                        <td className="py-1 border-b text-right font-medium">{v.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">Top Customers</h2>
            <div className="bg-white border rounded overflow-x-auto">
              {topCustomers.length === 0 ? (
                <p className="text-sm text-gray-500 p-4">No data</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium text-gray-500 py-2 px-4">Company</th>
                      <th className="text-right font-medium text-gray-500 py-2 px-4">Quotes</th>
                      <th className="text-right font-medium text-gray-500 py-2 px-4">Revenue</th>
                      <th className="text-right font-medium text-gray-500 py-2 px-4">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c) => (
                      <tr key={c.customerId} className="border-b last:border-0">
                        <td className="py-2 px-4">{c.companyName}</td>
                        <td className="py-2 px-4 text-right">{c.totalQuotes}</td>
                        <td className="py-2 px-4 text-right">{formatCurrency(c.grandTotal)}</td>
                        <td className="py-2 px-4 text-right">{(c.winRate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">Connectors</h2>
            <div className="bg-white border rounded overflow-x-auto">
              {connectors.length === 0 ? (
                <p className="text-sm text-gray-500 p-4">No connectors</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium text-gray-500 py-2 px-4">Label</th>
                      <th className="text-left font-medium text-gray-500 py-2 px-4">Type</th>
                      <th className="text-right font-medium text-gray-500 py-2 px-4">Intakes</th>
                      <th className="text-left font-medium text-gray-500 py-2 px-4">Last Sync</th>
                      <th className="text-right font-medium text-gray-500 py-2 px-4">Failures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connectors.map((c) => (
                      <tr key={c.connectorId} className="border-b last:border-0">
                        <td className="py-2 px-4">{c.label}</td>
                        <td className="py-2 px-4 capitalize">{c.type}</td>
                        <td className="py-2 px-4 text-right">{c.intakeCount}</td>
                        <td className="py-2 px-4">{c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleDateString() : "Never"}</td>
                        <td className={`py-2 px-4 text-right font-medium ${c.recentFailures > 0 ? "text-red-600" : "text-gray-600"}`}>
                          {c.recentFailures}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
