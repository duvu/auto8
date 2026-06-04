"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { API_BASE_URL } from "../../../lib/config";

export default function InviteAcceptPage() {
  const t = useTranslations("invite");
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/invite/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: params.token, password, name: name || undefined }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message ?? t("errorDefault");
        throw new Error(msg);
      }

      router.push("/rfqs");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorDefault"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-sm p-8">
        <div className="mb-6">
          <div className="text-xs font-medium tracking-widest text-muted uppercase mb-2">{t("eyebrow")}</div>
          <h1 className="text-2xl font-semibold text-ink">{t("submit")}</h1>
          <p className="text-sm text-muted mt-1">You&apos;ve been invited. Set your password to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">{t("yourName")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              autoFocus
              className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">{t("password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            {loading ? t("submitting") : "Accept invite"}
          </button>
        </form>
      </div>
    </main>
  );
}
