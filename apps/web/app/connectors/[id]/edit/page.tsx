"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { ConnectorView } from "@auto8/shared";

import { getConnector, updateConnector } from "../../../../lib/api";
import { WorkspaceShell } from "../../../../components/workspace-shell";
import { useRequireAuth } from "../../../../lib/use-require-auth";

export default function EditConnectorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [connector, setConnector] = useState<ConnectorView | null>(null);
  const [label, setLabel] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [credentials, setCredentials] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authResult = useRequireAuth("admin");

  useEffect(() => {
    void loadConnector();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function loadConnector() {
    setLoading(true);
    setError(null);
    try {
      const c = await getConnector(params.id);
      setConnector(c);
      setLabel(c.label);
      setIsEnabled(c.isEnabled);
      // credentials are intentionally not pre-populated for security
      setCredentials("{}");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connector.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let parsedCredentials: Record<string, string> | undefined;
    if (credentials.trim() && credentials.trim() !== "{}") {
      try {
        parsedCredentials = JSON.parse(credentials) as Record<string, string>;
      } catch {
        setError("Credentials must be valid JSON.");
        setSaving(false);
        return;
      }
    }

    try {
      await updateConnector(params.id, {
        label,
        isEnabled,
        ...(parsedCredentials ? { credentials: parsedCredentials } : {}),
      });
      router.push("/connectors");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connector.");
    } finally {
      setSaving(false);
    }
  }

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  if (loading) return (
    <WorkspaceShell title="Edit Connector" description="" authUser={authResult.user} section="Connectors">
      <div className="p-6 text-gray-500">Loading connector...</div>
    </WorkspaceShell>
  );

  if (!connector) return (
    <WorkspaceShell title="Edit Connector" description="" authUser={authResult.user} section="Connectors">
      <div className="p-6 text-red-600">Connector not found.</div>
    </WorkspaceShell>
  );

  return (
    <WorkspaceShell
      title="Edit Connector"
      description={`${connector.type} — ${connector.id}`}
      authUser={authResult.user}
      section="Connectors"
    >
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label htmlFor="label" className="block text-sm font-medium mb-1">Label</label>
            <input
              id="label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isEnabled"
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            <label htmlFor="isEnabled" className="text-sm">Enabled</label>
          </div>

          <div>
            <label htmlFor="credentials" className="block text-sm font-medium mb-1">
              Credentials (JSON)
            </label>
            <p className="text-xs text-gray-500 mb-1">
              Leave as <code>{"{}"}</code> to keep existing credentials unchanged.
            </p>
            <textarea
              id="credentials"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              rows={8}
              className="w-full border rounded px-3 py-2 text-sm font-mono"
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="border rounded px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => router.push("/connectors")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}
