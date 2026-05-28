"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CreateConnectorInput } from "@auto8/shared";

import { createConnector } from "../../../lib/api";

const CONNECTOR_TYPES = ["gmail", "slack"] as const;

export default function NewConnectorPage() {
  const router = useRouter();
  const [type, setType] = useState<"gmail" | "slack">("gmail");
  const [label, setLabel] = useState("");
  const [credentials, setCredentials] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let parsedCredentials: Record<string, string>;
    try {
      parsedCredentials = JSON.parse(credentials) as Record<string, string>;
    } catch {
      setError("Credentials must be valid JSON.");
      setLoading(false);
      return;
    }

    try {
      const input: CreateConnectorInput = { type, label, credentials: parsedCredentials };
      await createConnector(input);
      router.push("/connectors");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create connector.");
    } finally {
      setLoading(false);
    }
  }

  const credentialHints: Record<string, string> = {
    gmail: JSON.stringify(
      {
        clientId: "YOUR_CLIENT_ID",
        clientSecret: "YOUR_CLIENT_SECRET",
        refreshToken: "YOUR_REFRESH_TOKEN",
        query: "is:unread subject:RFQ",
      },
      null,
      2,
    ),
    slack: JSON.stringify(
      {
        botToken: "xoxb-YOUR-BOT-TOKEN",
        signingSecret: "YOUR_SIGNING_SECRET",
        workspaceId: "T0123456789",
      },
      null,
      2,
    ),
  };

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">auto8 / Admin</div>
        <h1>Add Connector</h1>
        <p className="panel-subtitle">Configure a new Gmail or Slack connector for RFQ ingestion.</p>
      </section>

      <section className="panel" style={{ maxWidth: 560, margin: "0 auto" }}>
        <form onSubmit={handleSubmit} className="stack">
          {error && <div className="error">{error}</div>}

          <label>
            Type
            <select
              value={type}
              onChange={(e) => {
                const t = e.target.value as "gmail" | "slack";
                setType(t);
                setCredentials(credentialHints[t] ?? "{}");
              }}
            >
              {CONNECTOR_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label>
            Label
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Main Gmail, Sales Slack"
              required
              autoFocus
            />
          </label>

          <label>
            Credentials (JSON)
            <textarea
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              rows={10}
              style={{ fontFamily: "monospace", fontSize: "12px" }}
              required
            />
          </label>

          <div className="actions">
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create connector"}
            </button>
            <button
              className="button-ghost"
              type="button"
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
