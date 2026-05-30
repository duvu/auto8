"use client";

import { useState } from "react";
import { AuditLogTable } from "../../components/AuditLogTable";
import { getAuditLogs } from "../../lib/api";
import type { AuditLogView } from "@auto8/shared";
import { WorkspaceShell } from "../../components/workspace-shell";
import { useRequireAuth } from "../../lib/use-require-auth";

const RESOURCE_TYPES = ["", "rfq", "quote", "quote_email"];

export default function AuditPage() {
  const [resourceType, setResourceType] = useState("");
  const [actorId, setActorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [logs, setLogs] = useState<AuditLogView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authResult = useRequireAuth();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLogs(
        {
          resourceType: resourceType || undefined,
          actorId: actorId || undefined,
          from: from || undefined,
          to: to || undefined,
        }
      );
      setLogs(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell
      title="Audit Logs"
      description="Search and inspect system audit events."
      authUser={authResult.user}
      section="Audit"
    >
      <div className="p-6 max-w-5xl">
        <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Resource Type</label>
              <select
                className="border rounded px-2 py-1 text-sm w-full"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t || "All"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Actor ID</label>
              <input
                className="border rounded px-2 py-1 text-sm w-full"
                value={actorId}
                onChange={(e) => setActorId(e.target.value)}
                placeholder="filter by actor"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="datetime-local"
                className="border rounded px-2 py-1 text-sm w-full"
                value={from}
                onChange={(e) => setFrom(e.target.value ? new Date(e.target.value).toISOString() : "")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="datetime-local"
                className="border rounded px-2 py-1 text-sm w-full"
                value={to}
                onChange={(e) => setTo(e.target.value ? new Date(e.target.value).toISOString() : "")}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </form>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        {logs !== null && <AuditLogTable logs={logs} />}
      </div>
    </WorkspaceShell>
  );
}
