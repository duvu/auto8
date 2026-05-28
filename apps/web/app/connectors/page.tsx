"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ConnectorSyncSummary, ConnectorView, IngestionRunView, PaginatedResponse } from "@auto8/shared";

import { deleteConnector, getConnectorRuns, getConnectors, syncConnectorNow, testConnector, updateConnector } from "../../lib/api";

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [syncResults, setSyncResults] = useState<Record<string, ConnectorSyncSummary | string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<Record<string, IngestionRunView[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  useEffect(() => {
    void loadConnectors();
  }, []);

  async function loadConnectors() {
    setLoading(true);
    setError(null);
    try {
      const result = await getConnectors();
      setConnectors(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connectors.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, isEnabled: boolean) {
    setWorking(id);
    setError(null);
    setSuccess(null);
    try {
      await updateConnector(id, { isEnabled: !isEnabled });
      setSuccess(`Connector ${isEnabled ? "disabled" : "enabled"}.`);
      await loadConnectors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update connector.");
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete connector "${label}"? This cannot be undone.`)) return;
    setWorking(id);
    setError(null);
    setSuccess(null);
    try {
      await deleteConnector(id);
      setSuccess(`Connector "${label}" deleted.`);
      await loadConnectors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete connector.");
    } finally {
      setWorking(null);
    }
  }

  async function handleTest(id: string) {
    setWorking(id);
    setTestResults((prev) => ({ ...prev, [id]: "Testing..." }));
    try {
      const result = await testConnector(id);
      setTestResults((prev) => ({
        ...prev,
        [id]: result.ok ? `OK: ${result.detail ?? "connected"}` : `Error: ${result.error ?? "test failed"}`,
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Test failed",
      }));
    } finally {
      setWorking(null);
    }
  }

  async function handleSyncNow(id: string) {
    setWorking(id);
    setSyncResults((prev) => ({ ...prev, [id]: "Syncing..." }));
    try {
      const result = await syncConnectorNow(id);
      setSyncResults((prev) => ({ ...prev, [id]: result }));
      await loadConnectors();
    } catch (err) {
      setSyncResults((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Sync failed",
      }));
    } finally {
      setWorking(null);
    }
  }

  async function handleToggleHistory(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (historyData[id]) return; // already loaded
    setHistoryLoading(id);
    try {
      const result: PaginatedResponse<IngestionRunView> = await getConnectorRuns(id, 1, 10);
      setHistoryData((prev) => ({ ...prev, [id]: result.data }));
    } catch {
      setHistoryData((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setHistoryLoading(null);
    }
  }

  if (loading) {
    return <main className="page"><section className="panel">Loading connectors...</section></main>;
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">auto8 / Admin</div>
        <div className="panel-header">
          <div className="stack">
            <h1>Connectors</h1>
            <p className="panel-subtitle">Manage Gmail, Slack, and Outlook connectors for RFQ ingestion.</p>
          </div>
          <div className="badge-row">
            <Link className="button-ghost" href="/">Back to dashboard</Link>
            <Link className="button" href="/connectors/new">Add connector</Link>
          </div>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <section className="panel">
        {connectors.length === 0 ? (
          <div className="empty">
            No connectors configured. <Link href="/connectors/new">Add one</Link> to start ingesting RFQs.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Label</th>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Type</th>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Status</th>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Last Sync</th>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Failures</th>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => {
                const syncRes = syncResults[c.id];
                const syncSummary = typeof syncRes === "object" ? syncRes as ConnectorSyncSummary : null;
                const syncErr = typeof syncRes === "string" && syncRes !== "Syncing..." ? syncRes : null;
                const runs = historyData[c.id] ?? [];
                return (
                  <>
                    <tr key={c.id}>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{c.label}</td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                        <span className="badge dark">{c.type}</span>
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                        <span className={`badge ${c.isEnabled ? "success" : ""}`}>
                          {c.isEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }} className="mono">
                        {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "—"}
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                        {c.failureCount > 0 ? (
                          <span className="badge">{c.failureCount}</span>
                        ) : "0"}
                      </td>
                      <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                        <div className="badge-row" style={{ gap: "4px", flexWrap: "wrap" }}>
                          <button
                            className="button-ghost"
                            type="button"
                            disabled={working === c.id}
                            onClick={() => void handleTest(c.id)}
                          >
                            Test
                          </button>
                          <button
                            className="button-ghost"
                            type="button"
                            disabled={working === c.id || c.type === "slack"}
                            title={c.type === "slack" ? "Slack is push-only" : undefined}
                            onClick={() => void handleSyncNow(c.id)}
                          >
                            Sync now
                          </button>
                          <button
                            className="button-ghost"
                            type="button"
                            disabled={working === c.id}
                            onClick={() => void handleToggleHistory(c.id)}
                          >
                            {expandedId === c.id ? "Hide history" : "View history"}
                          </button>
                          <Link className="button-ghost" href={`/connectors/${c.id}/edit`}>Edit</Link>
                          <button
                            className="button-ghost"
                            type="button"
                            disabled={working === c.id}
                            onClick={() => void handleToggle(c.id, c.isEnabled)}
                          >
                            {c.isEnabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            className="button-ghost"
                            type="button"
                            disabled={working === c.id}
                            onClick={() => void handleDelete(c.id, c.label)}
                          >
                            Delete
                          </button>
                        </div>
                        {testResults[c.id] && (
                          <div
                            className="mono"
                            style={{ fontSize: "11px", marginTop: "4px", color: testResults[c.id]?.startsWith("OK") ? "green" : "red" }}
                          >
                            {testResults[c.id]}
                          </div>
                        )}
                        {syncRes === "Syncing..." && (
                          <div className="mono" style={{ fontSize: "11px", marginTop: "4px", color: "#666" }}>Syncing...</div>
                        )}
                        {syncSummary && (
                          <div className="mono" style={{ fontSize: "11px", marginTop: "4px", color: "green" }}>
                            Sync done: {syncSummary.imported} imported, {syncSummary.skipped} skipped, {syncSummary.failed} failed
                          </div>
                        )}
                        {syncErr && (
                          <div className="mono" style={{ fontSize: "11px", marginTop: "4px", color: "red" }}>Sync error: {syncErr}</div>
                        )}
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr key={`${c.id}-history`}>
                        <td colSpan={6} style={{ padding: "8px 16px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          {historyLoading === c.id ? (
                            <div style={{ fontSize: "13px", color: "#666" }}>Loading history...</div>
                          ) : runs.length === 0 ? (
                            <div style={{ fontSize: "13px", color: "#666" }}>No runs yet.</div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                              <thead>
                                <tr>
                                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>Started</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>Imported</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>Skipped</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>Failed</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>Status</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}>Error</th>
                                </tr>
                              </thead>
                              <tbody>
                                {runs.map((r) => (
                                  <tr key={r.id}>
                                    <td className="mono" style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9" }}>
                                      {new Date(r.startedAt).toLocaleString()}
                                    </td>
                                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9" }}>{r.imported}</td>
                                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9" }}>{r.skipped}</td>
                                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9" }}>{r.failed}</td>
                                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9" }}>
                                      <span className={`badge ${r.status === "success" ? "success" : ""}`}>{r.status}</span>
                                    </td>
                                    <td className="mono" style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9", color: "red", fontSize: "11px" }}>
                                      {r.errorMessage ?? "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
