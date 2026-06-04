"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { ConnectorType, ConnectorView } from "@auto8/shared";
import { CONNECTOR_FIELD_DEFS } from "@auto8/shared";

import { getConnector, testConnector, updateConnector } from "../../../../lib/api";
import { ConnectorCredentialForm } from "../../../../components/connector-credential-form";
import { AppShell } from "../../../../components/app-shell";
import { useRequireAuth } from "../../../../lib/use-require-auth";

export default function EditConnectorPage({ params }: { params: { id: string } }) {
  const t = useTranslations("connectors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectedBanner = searchParams.get("connected") === "true";
  const [connector, setConnector] = useState<ConnectorView | null>(null);
  const [label, setLabel] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

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
      // Initialize empty credential fields — secrets stay blank, user only fills what they want to change
      const fields = CONNECTOR_FIELD_DEFS[c.type as ConnectorType] ?? [];
      const initial: Record<string, string> = {};
      for (const f of fields) {
        initial[f.key] = "";
      }
      setCredentials(initial);
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

    // Only send credentials that have been filled in
    const filledCredentials = Object.fromEntries(
      Object.entries(credentials).filter(([, v]) => v.trim() !== ""),
    );
    const credentialsToSend = Object.keys(filledCredentials).length > 0 ? filledCredentials : undefined;

    try {
      await updateConnector(params.id, {
        label,
        isEnabled,
        ...(credentialsToSend ? { credentials: credentialsToSend } : {}),
      });
      router.push("/connectors");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connector.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnector(params.id);
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

  if (loading)
    return (
      <AppShell title="Edit Connector">
        <div className="p-6 text-gray-500">Loading connector...</div>
      </AppShell>
    );

  if (!connector)
    return (
      <AppShell title="Edit Connector">
        <div className="p-6 text-red-600">Connector not found.</div>
      </AppShell>
    );

  const connectorType = connector.type as ConnectorType;

  return (
    <AppShell title="Edit Connector">
      <div className="max-w-2xl mx-auto">
        {connectedBanner && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded p-3 mb-4 text-sm">
            ✓ OAuth2 connection successful. Your connector is now authorized.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label htmlFor="label" className="block text-sm font-medium mb-1">{t("label")}</label>
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
            <label htmlFor="isEnabled" className="text-sm">
              Enabled
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t("credentials")}</label>
            <p className="text-xs text-gray-500 mb-3">
              Leave any field blank to keep the existing value. Only filled fields will be updated.
            </p>
            <ConnectorCredentialForm
              type={connectorType}
              credentials={credentials}
              onChange={setCredentials}
              editMode
            />
            {connectorType === "whatsapp" && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                <p className="font-medium text-blue-800 mb-1">Webhook URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-blue-200 rounded px-2 py-1 text-blue-900 font-mono break-all">
                    {typeof window !== "undefined" ? window.location.origin.replace(":3000", ":4000") : ""}/webhooks/whatsapp
                  </code>
                  <button
                    type="button"
                    className="border border-blue-300 rounded px-2 py-1 hover:bg-blue-100 text-blue-700"
                    onClick={() => void navigator.clipboard.writeText(`${window.location.origin.replace(":3000", ":4000")}/webhooks/whatsapp`)}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>

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
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto"
              disabled={saving}
            >
              {saving ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              className="border rounded px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 w-full sm:w-auto"
              disabled={testing}
              onClick={() => void handleTest()}
            >
              {testing ? t("testingConnection") : t("testConnection")}
            </button>
            <button
              type="button"
              className="border rounded px-4 py-2 text-sm hover:bg-gray-50 w-full sm:w-auto"
              onClick={() => router.push("/connectors")}
            >{t("cancel")}</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
