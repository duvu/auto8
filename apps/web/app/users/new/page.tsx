"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createUser } from "../../../lib/api";
import { WorkspaceShell } from "../../../components/workspace-shell";
import { useRequireAuth } from "../../../lib/use-require-auth";

const ROLES = ["quote_operator", "sales_approver", "admin"];

export default function NewUserPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("quote_operator");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authResult = useRequireAuth("admin");

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

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell
      title="Add User"
      description="Create a new system user."
      authUser={authResult.user}
      section="Users"
    >
      <div className="max-w-xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              autoFocus
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@auto8.dev"
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create user"}
            </button>
            <button
              className="border rounded px-4 py-2 text-sm hover:bg-gray-50"
              type="button"
              onClick={() => router.push("/users")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}
