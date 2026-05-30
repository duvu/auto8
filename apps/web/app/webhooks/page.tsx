"use client";

import { useEffect, useState } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { useRequireAuth } from "../../lib/use-require-auth";
import { WebhookEndpoint, listWebhookEndpoints, createWebhookEndpoint, deleteWebhookEndpoint, testWebhookEndpoint } from "../../lib/api";

const AVAILABLE_EVENTS = ["rfq.created", "quote.approved", "quote.sent"];

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  // Form state
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [newEvents, setNewEvents] = useState<Set<string>>(new Set());

  const authResult = useRequireAuth("admin");

  useEffect(() => {
    void loadEndpoints();
  }, []);

  async function loadEndpoints() {
    setLoading(true);
    setError(null);
    try {
      const data = await listWebhookEndpoints();
      setEndpoints(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhook endpoints.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl) return;
    if (newEvents.size === 0) {
      setError("Please select at least one event.");
      return;
    }

    setWorking("create");
    setError(null);
    setSuccess(null);

    try {
      await createWebhookEndpoint({
        url: newUrl,
        events: Array.from(newEvents),
        secret: newSecret || undefined,
      });
      setSuccess("Webhook endpoint created.");
      setNewUrl("");
      setNewSecret("");
      setNewEvents(new Set());
      await loadEndpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook endpoint.");
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this webhook endpoint? This cannot be undone.")) return;
    setWorking(id);
    setError(null);
    setSuccess(null);
    try {
      await deleteWebhookEndpoint(id);
      setSuccess("Webhook endpoint deleted.");
      await loadEndpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete webhook endpoint.");
    } finally {
      setWorking(null);
    }
  }

  async function handleTest(id: string) {
    setWorking(id);
    setTestResults((prev) => ({ ...prev, [id]: "Testing..." }));
    try {
      const result = await testWebhookEndpoint(id);
      setTestResults((prev) => ({
        ...prev,
        [id]: result.ok ? "OK: Event sent successfully" : `Error: ${result.error ?? "Test failed"}`,
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

  function toggleEvent(ev: string) {
    const next = new Set(newEvents);
    if (next.has(ev)) next.delete(ev);
    else next.add(ev);
    setNewEvents(next);
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading webhooks...</div>;
  }

  if (!authResult) return null;

  if (authResult.forbidden) {
    return <div className="p-6 text-red-600">Access Denied</div>;
  }

  return (
    <WorkspaceShell
      title="Webhooks"
      description="Manage outbound webhook endpoints to receive notifications on various events."
      authUser={authResult.user}
      section="Settings"
    >
      <div className="p-6 max-w-5xl">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded p-3 mb-4 text-sm">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-medium text-ink mb-4">Existing Endpoints</h2>
            {endpoints.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm font-medium text-ink mb-1">No webhooks configured</p>
                <p className="text-xs text-muted">Add your first webhook endpoint to start receiving events.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="border px-3 py-2">URL</th>
                      <th className="border px-3 py-2">Events</th>
                      <th className="border px-3 py-2">Status</th>
                      <th className="border px-3 py-2">Created</th>
                      <th className="border px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((ep) => (
                      <tr key={ep.id}>
                        <td className="border px-3 py-2 font-mono text-xs truncate max-w-[200px]" title={ep.url}>
                          {ep.url}
                        </td>
                        <td className="border px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {ep.events.map((e) => (
                              <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                {e}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="border px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${ep.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {ep.isEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </td>
                        <td className="border px-3 py-2 font-mono text-xs">
                          {new Date(ep.createdAt).toLocaleString()}
                        </td>
                        <td className="border px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              className="text-xs border rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                              onClick={() => void handleTest(ep.id)}
                              disabled={working === ep.id}
                            >
                              Test
                            </button>
                            <button
                              className="text-xs border rounded px-2 py-1 hover:bg-red-50 text-red-600 disabled:opacity-50"
                              onClick={() => void handleDelete(ep.id)}
                              disabled={working === ep.id}
                            >
                              Delete
                            </button>
                          </div>
                          {testResults[ep.id] && (
                            <div className="font-mono text-[10px] mt-1" style={{ color: testResults[ep.id]?.startsWith("OK") ? "green" : "red" }}>
                              {testResults[ep.id]}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="text-sm font-medium text-ink mb-4">Add Endpoint</h2>
              <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Payload URL</label>
                  <input
                    type="url"
                    required
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com/webhook"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Secret (Optional)</label>
                  <input
                    type="text"
                    value={newSecret}
                    onChange={(e) => setNewSecret(e.target.value)}
                    placeholder="Webhook signing secret"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                  <p className="text-[10px] text-muted mt-1">Used to compute x-auto8-signature header.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-2">Events to send</label>
                  <div className="space-y-2">
                    {AVAILABLE_EVENTS.map((ev) => (
                      <label key={ev} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newEvents.has(ev)}
                          onChange={() => toggleEvent(ev)}
                          className="rounded border-gray-300"
                        />
                        {ev}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={working === "create"}
                  className="w-full bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {working === "create" ? "Adding..." : "Add Endpoint"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
