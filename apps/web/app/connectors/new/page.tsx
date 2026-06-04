"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { ConnectorType, CreateConnectorInput } from "@auto8/shared";
import { CONNECTOR_TYPES } from "@auto8/shared";

import { createConnector, getOAuth2Providers, startOAuth2Flow, testConnectorCredentials } from "../../../lib/api";
import { ConnectorCredentialForm, emptyCredentials, validateConnectorCredentials } from "../../../components/connector-credential-form";
import { ConnectorSetupGuide } from "../../../components/connector-setup-guide";
import { AppShell } from "../../../components/app-shell";
import { useRequireAuth } from "../../../lib/use-require-auth";

const OAUTH2_PROVIDER_LABEL: Partial<Record<ConnectorType, string>> = {
  gmail: "Connect with Google",
  slack: "Connect with Slack",
  outlook: "Connect with Microsoft",
};

export default function NewConnectorPage() {
  const t = useTranslations("connectors");
  const router = useRouter();
  const [type, setType] = useState<ConnectorType>("gmail");
  const [label, setLabel] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>(emptyCredentials("gmail"));
  const [loading, setLoading] = useState(false);
  const [oauth2Loading, setOauth2Loading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
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
    getOAuth2Providers()
      .then((p) => {
        setOauth2Providers({
          ...p,
          whatsapp: false,
          telegram: false,
          zalo: false,
        } as Record<ConnectorType, boolean>);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  function handleTypeChange(newType: ConnectorType) {
    setType(newType);
    setCredentials(emptyCredentials(newType));
    setTestResult(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateConnectorCredentials(type, credentials)) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const input: CreateConnectorInput = { type, label, credentials };
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
      if (type === "whatsapp" || type === "telegram" || type === "zalo")
        throw new Error("OAuth2 not supported for this type");
      await startOAuth2Flow(type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth2 flow.");
      setOauth2Loading(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnectorCredentials(type, credentials);
      setTestResult({
        ok: result.ok,
        message: result.ok ? (result.detail ?? "Connection successful") : (result.error ?? "Test failed"),
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  const useOAuth2 = oauth2Providers[type];

  return (
    <AppShell title="Add Connector">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
        )}

        {/* Type selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">{t("type")}</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as ConnectorType)}
            className="border rounded px-3 py-2 text-sm w-full"
          >
            {CONNECTOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Setup guide (collapsed by default) */}
        <div className="mb-4">
          <ConnectorSetupGuide type={type} />
        </div>

        {useOAuth2 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click the button below to authorize via{" "}
              {type === "gmail" ? "Google" : type === "outlook" ? "Microsoft" : "Slack"}. A connector will be
              created automatically after authorization.
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
              >{t("cancel")}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Label */}
            <div>
              <label className="block text-sm font-medium mb-1">{t("label")}</label>
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

            {/* Structured credential fields */}
            <div>
              <label className="block text-sm font-medium mb-2">{t("credentials")}</label>
              <ConnectorCredentialForm
                type={type}
                credentials={credentials}
                onChange={setCredentials}
              />
            </div>

            {/* Test connection result */}
            {testResult && (
              <div
                className={`rounded p-3 text-sm ${
                  testResult.ok
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {testResult.ok ? "✓ " : "✗ "}
                {testResult.message}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto"
                type="submit"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create connector"}
              </button>
              <button
                className="border rounded px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 w-full sm:w-auto"
                type="button"
                disabled={testing}
                onClick={() => void handleTestConnection()}
              >
                {testing ? t("testingConnection") : t("testConnection")}
              </button>
              <button
                className="border rounded px-4 py-2 text-sm hover:bg-gray-50 w-full sm:w-auto"
                type="button"
                onClick={() => router.push("/connectors")}
              >{t("cancel")}</button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
