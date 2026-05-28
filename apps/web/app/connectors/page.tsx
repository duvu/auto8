"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ConnectorView } from "@auto8/shared";

import { deleteConnector, getConnectors, testConnector, updateConnector } from "../../lib/api";

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

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
            <p className="panel-subtitle">Manage Gmail and Slack connectors for RFQ ingestion.</p>
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
              {connectors.map((c) => (
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
                    <div className="badge-row" style={{ gap: "4px" }}>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
