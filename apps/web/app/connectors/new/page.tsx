"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { CreateConnectorInput, ConnectorType } from "@auto8/shared";
import { CONNECTOR_TYPES } from "@auto8/shared";

import { createConnector, getOAuth2Providers, startOAuth2Flow } from "../../../lib/api";
import { WorkspaceShell } from "../../../components/workspace-shell";
import { useRequireAuth } from "../../../lib/use-require-auth";

const OAUTH2_PROVIDER_LABEL: Partial<Record<ConnectorType, string>> = {
  gmail: "Connect with Google",
  slack: "Connect with Slack",
  outlook: "Connect with Microsoft",
};

export default function NewConnectorPage() {
  const router = useRouter();
  const [type, setType] = useState<ConnectorType>("gmail");
  const [label, setLabel] = useState("");
  const [credentials, setCredentials] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [oauth2Loading, setOauth2Loading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauth2Providers, setOauth2Providers] = useState<Record<ConnectorType, boolean>>({
    gmail: false,
    slack: false,
    outlook: false,
    whatsapp: false,
    telegram: false,
    zalo: false,
  });

  const authResult = useRequireAuth("admin");

  useEffect(() => {
    getOAuth2Providers().then((p) => {
      setOauth2Providers({
        ...p,
        whatsapp: false,
        telegram: false,
        zalo: false,
      } as Record<ConnectorType, boolean>);
    }).catch(() => {/* ignore */});
  }, []);

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

  async function handleOAuth2Connect() {
    setOauth2Loading(true);
    setError(null);
    try {
      if (type === "whatsapp" || type === "telegram" || type === "zalo") throw new Error("OAuth2 not supported for this type");
      await startOAuth2Flow(type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth2 flow.");
      setOauth2Loading(false);
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
    outlook: JSON.stringify(
      {
        clientId: "YOUR_AZURE_APP_CLIENT_ID",
        clientSecret: "YOUR_AZURE_APP_CLIENT_SECRET",
        refreshToken: "YOUR_REFRESH_TOKEN",
        tenantId: "common",
        maxResults: 50,
        markAsRead: true,
      },
      null,
      2,
    ),
    whatsapp: JSON.stringify(
      {
        appSecret: "YOUR_APP_SECRET",
        phoneNumberId: "YOUR_PHONE_NUMBER_ID",
        accessToken: "YOUR_ACCESS_TOKEN",
        verifyToken: "YOUR_VERIFY_TOKEN"
      },
      null,
      2
    ),
    telegram: JSON.stringify(
      {
        botToken: "YOUR_BOT_TOKEN",
        secret: "YOUR_WEBHOOK_SECRET"
      },
      null,
      2
    ),
    zalo: JSON.stringify(
      {
        appId: "YOUR_ZALO_APP_ID",
        appSecret: "YOUR_ZALO_APP_SECRET",
        verifyToken: "YOUR_VERIFY_TOKEN",
        oaAccessToken: "(optional — required for testConnector)"
      },
      null,
      2
    ),
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  const useOAuth2 = oauth2Providers[type];

  return (
    <WorkspaceShell
      title="Add Connector"
      description="Configure a new Gmail, Slack, Outlook, WhatsApp, Telegram, or Zalo connector for RFQ ingestion."
      authUser={authResult.user}
      section="Connectors"
    >
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => {
              const t = e.target.value as ConnectorType;
              setType(t);
              setCredentials(credentialHints[t] ?? "{}");
            }}
            className="border rounded px-3 py-2 text-sm w-full"
          >
            {CONNECTOR_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {useOAuth2 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click the button below to authorize via {type === "gmail" ? "Google" : type === "outlook" ? "Microsoft" : "Slack"}.
              A connector will be created automatically after authorization.
            </p>
            <div className="flex gap-3">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                type="button"
                disabled={oauth2Loading}
                onClick={() => void handleOAuth2Connect()}
              >
                {oauth2Loading ? "Redirecting..." : (OAUTH2_PROVIDER_LABEL[type] ?? "Connect")}
              </button>
              <button
                className="border rounded px-4 py-2 text-sm hover:bg-gray-50"
                type="button"
                onClick={() => router.push("/connectors")}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Main Gmail, Sales Slack"
                required
                autoFocus
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Credentials (JSON)</label>
              <textarea
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                rows={10}
                className="border rounded px-3 py-2 text-sm w-full font-mono text-xs"
                required
              />
            </div>

            <div className="flex gap-3">
              <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50" type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create connector"}
              </button>
              <button
                className="border rounded px-4 py-2 text-sm hover:bg-gray-50"
                type="button"
                onClick={() => router.push("/connectors")}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </WorkspaceShell>
  );
}
