"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { ConnectorView } from "@auto8/shared";

import { getConnector, updateConnector } from "../../../../lib/api";

export default function EditConnectorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [connector, setConnector] = useState<ConnectorView | null>(null);
  const [label, setLabel] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [credentials, setCredentials] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return <main className="page"><section className="panel">Loading connector...</section></main>;
  }

  if (!connector) {
    return <main className="page"><section className="panel error">Connector not found.</section></main>;
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">auto8 / Admin / Connectors</div>
        <h1>Edit Connector</h1>
        <p className="panel-subtitle">{connector.type} — {connector.id}</p>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <form onSubmit={(e) => void handleSave(e)} style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "560px" }}>
          <div>
            <label htmlFor="label" style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Label</label>
            <input
              id="label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              style={{ width: "100%", padding: "8px", border: "1px solid #e2e8f0", borderRadius: "4px", fontSize: "14px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              id="isEnabled"
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            <label htmlFor="isEnabled">Enabled</label>
          </div>

          <div>
            <label htmlFor="credentials" style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Credentials (JSON)
            </label>
            <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px" }}>
              Leave as <code>{"{}"}</code> to keep existing credentials unchanged.
            </p>
            <textarea
              id="credentials"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              rows={8}
              style={{ width: "100%", padding: "8px", border: "1px solid #e2e8f0", borderRadius: "4px", fontSize: "13px", fontFamily: "monospace" }}
            />
          </div>

          <div className="badge-row">
            <button type="submit" className="button" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => router.push("/connectors")}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
