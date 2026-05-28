"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { authResetPassword } from "../../lib/api";

function ResetPasswordForm() {
  const router = useRouter();
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
      setError(err instanceof Error ? err.message : "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">auto8 / MVP1</div>
        <h1>Reset Password</h1>
        <p className="panel-subtitle">Enter your new password below.</p>
      </section>

      <section className="panel" style={{ maxWidth: 400, margin: "0 auto" }}>
        <form onSubmit={handleSubmit} className="stack">
          {error && <div className="error">{error}</div>}

          <label>
            New Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              autoFocus
            />
          </label>

          <div className="actions">
            <button className="button" type="submit" disabled={loading || !token}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </div>

          {!token && (
            <p className="error">Invalid or missing reset token. Please request a new password reset link.</p>
          )}
        </form>
      </section>
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
