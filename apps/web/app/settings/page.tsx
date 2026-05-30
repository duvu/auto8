"use client";

import { useEffect, useState } from "react";
import type { LlmProviderKind, LlmSettingView, LlmTestResult, SlaConfigView } from "@auto8/shared";
import { getLlmSetting, getSlaConfig, updateLlmSetting, updateSlaConfig, testLlmConnection } from "../../lib/api";
import { WorkspaceShell } from "../../components/workspace-shell";
import { useRequireAuth } from "../../lib/use-require-auth";

const PROVIDERS: { value: LlmProviderKind; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google Gemini" },
  { value: "ollama", label: "Ollama (local)" },
];

const DEFAULT_MODELS: Record<LlmProviderKind, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  google: "gemini-1.5-flash",
  ollama: "llama3.2",
};

export default function SettingsPage() {
  const [setting, setSetting] = useState<LlmSettingView | null>(null);
  const [provider, setProvider] = useState<LlmProviderKind>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);
  const [saveMessage, setSaveMessage] = useState("");

  const [slaConfig, setSlaConfig] = useState<SlaConfigView | null>(null);
  const [slaHours, setSlaHours] = useState(24);
  const [slaWarning, setSlaWarning] = useState(4);
  const [slaSaving, setSlaSaving] = useState(false);
  const [slaSaveMessage, setSlaSaveMessage] = useState("");

  const authResult = useRequireAuth("admin");

  useEffect(() => {
    void getLlmSetting().then((s) => {
      setSetting(s);
      setProvider(s.provider);
      setModel(s.model);
      setBaseUrl(s.baseUrl ?? "");
    });
    void getSlaConfig().then((s) => {
      setSlaConfig(s);
      setSlaHours(s.defaultResponseHours);
      setSlaWarning(s.warningThresholdHours);
    });
  }, []);

  const handleSaveSla = async () => {
    setSlaSaving(true);
    setSlaSaveMessage("");
    try {
      const updated = await updateSlaConfig({ defaultResponseHours: slaHours, warningThresholdHours: slaWarning });
      setSlaConfig(updated);
      setSlaSaveMessage("SLA settings saved.");
    } catch {
      setSlaSaveMessage("Failed to save SLA settings.");
    } finally {
      setSlaSaving(false);
    }
  };

  const handleProviderChange = (p: LlmProviderKind) => {
    setProvider(p);
    setModel(DEFAULT_MODELS[p]);
    setBaseUrl("");
    setApiKey("");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage("");
    try {
      const updated = await updateLlmSetting({
        provider,
        model,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
      });
      setSetting(updated);
      setSaveMessage("Settings saved.");
      setApiKey(""); // Clear key field after save
    } catch {
      setSaveMessage("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLlmConnection();
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, error: "Request failed" });
    } finally {
      setTesting(false);
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell
      title="LLM Provider Settings"
      description="Configure the AI provider used for RFQ classification and extraction."
      authUser={authResult.user}
      section="Settings"
    >
      <div className="max-w-xl mx-auto">
        {setting && (
          <div className="mb-4 text-sm text-gray-500">
            Status:{" "}
            <span className={setting.isConfigured ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
              {setting.isConfigured ? "Configured" : "Not configured"}
            </span>
            {" · "}Current: <span className="font-mono">{setting.provider} / {setting.model}</span>
            {setting.apiKeyMasked && <span> · Key: <span className="font-mono">{setting.apiKeyMasked}</span></span>}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as LlmProviderKind)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm font-mono"
              placeholder={DEFAULT_MODELS[provider]}
            />
          </div>

          {provider !== "ollama" && (
            <div>
              <label className="block text-sm font-medium mb-1">
                API Key {setting?.apiKeyMasked ? `(current: ${setting.apiKeyMasked})` : ""}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm font-mono"
                placeholder="Leave blank to keep existing key"
                autoComplete="off"
              />
            </div>
          )}

          {(provider === "ollama" || provider === "openai") && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Base URL {provider === "ollama" ? "(required)" : "(optional, for custom endpoints)"}
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm font-mono"
                placeholder={provider === "ollama" ? "http://localhost:11434/v1" : "https://api.openai.com/v1"}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            <button
              onClick={() => void handleTest()}
              disabled={testing}
              className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>

          {saveMessage && (
            <p className="text-sm text-gray-600">{saveMessage}</p>
          )}

          {testResult && (
            <div className={`p-3 rounded text-sm ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult.ok
                ? `Connection OK — ${testResult.latencyMs ?? 0}ms — ${testResult.response ?? ""}`
                : `Failed: ${testResult.error ?? "Unknown error"}`}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto mt-8">
        <h2 className="text-base font-semibold mb-3">SLA / Deadline Settings</h2>
        <p className="text-sm text-gray-500 mb-4">
          Configure automatic response deadlines for new RFQs. Overdue RFQs are flagged with an Overdue badge on the dashboard.
        </p>
        {slaConfig && (
          <div className="mb-3 text-sm text-gray-500">
            Current: {slaConfig.defaultResponseHours}h response window · {slaConfig.warningThresholdHours}h warning threshold
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Default Response Window (hours)</label>
            <input
              type="number"
              min={1}
              max={720}
              value={slaHours}
              onChange={(e) => setSlaHours(parseInt(e.target.value) || 24)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Warning Threshold (hours before deadline)</label>
            <input
              type="number"
              min={0}
              max={slaHours - 1}
              value={slaWarning}
              onChange={(e) => setSlaWarning(parseInt(e.target.value) || 4)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => void handleSaveSla()}
              disabled={slaSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {slaSaving ? "Saving..." : "Save SLA Settings"}
            </button>
          </div>
          {slaSaveMessage && (
            <p className="text-sm text-gray-600">{slaSaveMessage}</p>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
