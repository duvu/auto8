"use client";

import { useEffect, useState } from "react";
import type { LlmProviderKind, LlmSettingView, LlmTestResult } from "@auto8/shared";
import { getLlmSetting, updateLlmSetting, testLlmConnection } from "../../lib/api";

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

  useEffect(() => {
    void getLlmSetting().then((s) => {
      setSetting(s);
      setProvider(s.provider);
      setModel(s.model);
      setBaseUrl(s.baseUrl ?? "");
    });
  }, []);

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

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">LLM Provider Settings</h1>

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
  );
}
