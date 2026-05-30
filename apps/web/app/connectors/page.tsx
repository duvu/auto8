"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import type { ConnectorSyncSummary, ConnectorView, IngestionRunView, PaginatedResponse } from "@auto8/shared";

import { deleteConnector, getConnectorRuns, getConnectors, syncConnectorNow, testConnector, updateConnector } from "../../lib/api";
import { useRequireAuth } from "../../lib/use-require-auth";
import { WorkspaceShell } from "../../components/workspace-shell";

function OAuth2ErrorBanner() {
  const searchParams = useSearchParams();
  const oauth2Error = searchParams.get("error");
  if (oauth2Error === "oauth2_failed") return <div className="error">OAuth2 authorization failed. Please try again.</div>;
  if (oauth2Error === "oauth2_denied") return <div className="error">OAuth2 authorization was denied.</div>;
  return null;
}

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

  const authResult = useRequireAuth("admin");

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
    return <div className="p-6 text-sm text-gray-500">Loading connectors...</div>;
  }

  if (!authResult) return null;

  if (authResult.forbidden) {
    return <div className="p-6 text-red-600">Access Denied</div>;
  }

  return (
    <WorkspaceShell title="Connectors" description="Manage Gmail, Slack, and Outlook connectors for RFQ ingestion." authUser={authResult.user} section="Connectors">
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div />
        <div className="flex items-center gap-2">
          <Link href="/" className="border border-gray-400 text-gray-700 px-4 py-2 rounded hover:bg-gray-100 text-sm">Back to dashboard</Link>
          <Link href="/connectors/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Add connector</Link>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded p-3 mb-4 text-sm">{success}</div>}
      <Suspense><OAuth2ErrorBanner /></Suspense>

      {connectors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-ink mb-1">No connectors configured</p>
          <p className="text-xs text-muted mb-4">Connect an email inbox (Gmail, Outlook) or Slack workspace to automatically ingest RFQs into the queue.</p>
          <Link href="/connectors/new" className="inline-flex items-center gap-1 text-sm font-medium text-accent underline hover:opacity-80">Add your first connector →</Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="border px-3 py-2">Label</th>
                <th className="border px-3 py-2">Type</th>
                <th className="border px-3 py-2">Status</th>
                <th className="border px-3 py-2">Last Sync</th>
                <th className="border px-3 py-2">Failures</th>
                <th className="border px-3 py-2">Actions</th>
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
                      <td className="border px-3 py-2">{c.label}</td>
                      <td className="border px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{c.type}</span>
                      </td>
                      <td className="border px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${c.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {c.isEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="border px-3 py-2 font-mono text-xs">
                        {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "—"}
                      </td>
                      <td className="border px-3 py-2 text-center">
                        {c.failureCount > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">{c.failureCount}</span>
                        ) : "0"}
                      </td>
                      <td className="border px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button className="text-xs border rounded px-2 py-1 hover:bg-gray-50" type="button" disabled={working === c.id} onClick={() => void handleTest(c.id)}>Test</button>
                          <button className="text-xs border rounded px-2 py-1 hover:bg-gray-50" type="button" disabled={working === c.id || c.type === "slack"} title={c.type === "slack" ? "Slack is push-only" : undefined} onClick={() => void handleSyncNow(c.id)}>Sync now</button>
                          <button className="text-xs border rounded px-2 py-1 hover:bg-gray-50" type="button" disabled={working === c.id} onClick={() => void handleToggleHistory(c.id)}>{expandedId === c.id ? "Hide history" : "View history"}</button>
                          <Link className="text-xs border rounded px-2 py-1 hover:bg-gray-50" href={`/connectors/${c.id}/edit`}>Edit</Link>
                          <button className="text-xs border rounded px-2 py-1 hover:bg-gray-50" type="button" disabled={working === c.id} onClick={() => void handleToggle(c.id, c.isEnabled)}>{c.isEnabled ? "Disable" : "Enable"}</button>
                          <button className="text-xs border rounded px-2 py-1 hover:bg-red-50 text-red-600" type="button" disabled={working === c.id} onClick={() => void handleDelete(c.id, c.label)}>Delete</button>
                        </div>
                        {testResults[c.id] && (
                          <div className="font-mono text-xs mt-1" style={{ color: testResults[c.id]?.startsWith("OK") ? "green" : "red" }}>{testResults[c.id]}</div>
                        )}
                        {syncRes === "Syncing..." && <div className="font-mono text-xs mt-1 text-gray-500">Syncing...</div>}
                        {syncSummary && <div className="font-mono text-xs mt-1 text-green-600">Sync done: {syncSummary.imported} imported, {syncSummary.skipped} skipped, {syncSummary.failed} failed</div>}
                        {syncErr && <div className="font-mono text-xs mt-1 text-red-600">Sync error: {syncErr}</div>}
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr key={`${c.id}-history`}>
                        <td colSpan={6} className="border px-3 py-3 bg-gray-50">
                          {historyLoading === c.id ? (
                            <div className="text-xs text-gray-500">Loading history...</div>
                          ) : runs.length === 0 ? (
                            <div className="text-xs text-gray-500">No runs yet.</div>
                          ) : (
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr>
                                  <th className="text-left px-2 py-1 border-b">Started</th>
                                  <th className="text-left px-2 py-1 border-b">Imported</th>
                                  <th className="text-left px-2 py-1 border-b">Skipped</th>
                                  <th className="text-left px-2 py-1 border-b">Failed</th>
                                  <th className="text-left px-2 py-1 border-b">Status</th>
                                  <th className="text-left px-2 py-1 border-b">Error</th>
                                </tr>
                              </thead>
                              <tbody>
                                {runs.map((r) => (
                                  <tr key={r.id}>
                                    <td className="font-mono px-2 py-1 border-b">{new Date(r.startedAt).toLocaleString()}</td>
                                    <td className="px-2 py-1 border-b">{r.imported}</td>
                                    <td className="px-2 py-1 border-b">{r.skipped}</td>
                                    <td className="px-2 py-1 border-b">{r.failed}</td>
                                    <td className="px-2 py-1 border-b">
                                      <span className={`px-1.5 py-0.5 rounded text-xs ${r.status === "success" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                                    </td>
                                    <td className="font-mono px-2 py-1 border-b text-red-600">{r.errorMessage ?? "—"}</td>
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
        </div>
      )}
    </div>
    </WorkspaceShell>
  );
}
