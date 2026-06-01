"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { getWorkspace, updateWorkspace, type WorkspaceView } from "../../../lib/api";
import { API_BASE_URL } from "../../../lib/config";

export default function WorkspaceSettingsPage() {
  const auth = useRequireAuth("admin");
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  useEffect(() => {
    if (!auth || auth.forbidden) return;
    getWorkspace("default")
      .then((w) => {
        setWorkspace(w);
        setName(w.name);
        setSlug(w.slug);
      })
      .catch(() => setError("Failed to load workspace settings."));
  }, [auth]);

  if (!auth || auth.forbidden) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updateWorkspace(workspace.id, { name, slug });
      setWorkspace(updated);
      setName(updated.name);
      setSlug(updated.slug);
      setSuccess("Workspace settings saved.");
    } catch {
      setError("Failed to save workspace settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Failed to send invite.");
      }
      setInviteMsg(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
    } catch (err) {
      setInviteMsg(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <AppShell title="Workspace Settings">
      <div className="max-w-lg">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded p-3 mb-4 text-sm">{success}</div>
        )}
        <form onSubmit={(e) => { void handleSave(e); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              pattern="[a-z0-9-]+"
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <p className="text-xs text-muted mt-1">Lowercase letters, numbers, hyphens only.</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving\u2026" : "Save Changes"}
          </button>
        </form>

        <hr className="my-8 border-border" />

        <h2 className="text-lg font-semibold text-ink mb-2">Invite Colleague</h2>
        <p className="text-sm text-muted mb-4">Send an invite email. They&apos;ll join as a quote operator.</p>
        {inviteMsg && (
          <div className={`rounded p-3 mb-4 text-sm border ${inviteMsg.startsWith("Invite sent") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {inviteMsg}
          </div>
        )}
        <form onSubmit={(e) => { void handleInvite(e); }} className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
            className="border rounded px-3 py-2 text-sm flex-1"
          />
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            {inviting ? "Sending..." : "Send Invite"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
