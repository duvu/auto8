"use client";

import { useState } from "react";

import { authForgotPassword } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await authForgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">auto8 / MVP1</div>
        <h1>Forgot Password</h1>
        <p className="panel-subtitle">Enter your email and we&apos;ll send you a reset link.</p>
      </section>

      <section className="panel" style={{ maxWidth: 400, margin: "0 auto" }}>
        {submitted ? (
          <div className="stack">
            <p>Check your email for a password reset link. It will expire in 1 hour.</p>
            <a href="/login" className="button-ghost">Back to sign in</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="stack">
            {error && <div className="error">{error}</div>}

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </label>

            <div className="actions">
              <button className="button" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <a href="/login" className="button-ghost">Back to sign in</a>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
