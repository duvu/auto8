"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createUser } from "../../../lib/api";

const ROLES = ["quote_operator", "sales_approver", "admin"];

export default function NewUserPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("quote_operator");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createUser({ name, email, role, password });
      router.push("/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">auto8 / Admin</div>
        <h1>Add User</h1>
        <p className="panel-subtitle">Create a new system user.</p>
      </section>

      <section className="panel" style={{ maxWidth: 480, margin: "0 auto" }}>
        <form onSubmit={handleSubmit} className="stack">
          {error && <div className="error">{error}</div>}

          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              autoFocus
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@auto8.dev"
              required
            />
          </label>

          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
            />
          </label>

          <div className="actions">
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create user"}
            </button>
            <button
              className="button-ghost"
              type="button"
              onClick={() => router.push("/users")}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
