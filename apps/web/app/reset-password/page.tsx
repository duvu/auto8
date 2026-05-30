"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { authResetPassword } from "../../lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const t = useTranslations("resetPassword");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await authResetPassword(token, password);
      router.push("/login");
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
          <h1 className="text-2xl font-semibold text-ink">{t("title")}</h1>
          <p className="text-sm text-muted mt-1">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="error">{error}</div>}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">{t("newPassword")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("newPasswordPlaceholder")}
              minLength={8}
              required
              autoFocus
              className="w-full border border-border rounded-lg px-3 py-2 bg-surface text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {!token && (
            <p className="error">{t("invalidToken")}</p>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("submitting") : t("submit")}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
