"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { UserView } from "@auto8/shared";

import { deleteUser, getUsers, updateUser } from "../../lib/api";
import { getAuthUser } from "../../lib/auth";
import type { AuthUser } from "../../lib/auth";

export default function UsersPage() {
  const [users, setUsers] = useState<UserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    void getAuthUser().then(setAuthUser);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const result = await getUsers();
      setUsers(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(id: string, name: string) {
    setWorking(id);
    setError(null);
    setSuccess(null);
    try {
      await deleteUser(id);
      setSuccess(`${name} deactivated.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate user.");
    } finally {
      setWorking(null);
    }
  }

  async function handleReactivate(id: string, name: string) {
    setWorking(id);
    setError(null);
    setSuccess(null);
    try {
      await updateUser(id, { isActive: true });
      setSuccess(`${name} reactivated.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reactivate user.");
    } finally {
      setWorking(null);
    }
  }

  if (loading) {
    return <main className="page"><section className="panel">Loading users...</section></main>;
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">auto8 / Admin</div>
        <div className="panel-header">
          <div className="stack">
            <h1>User Management</h1>
            <p className="panel-subtitle">Manage system users, roles, and access.</p>
          </div>
          <div className="badge-row">
            <Link className="button-ghost" href="/">Back to dashboard</Link>
            {authUser?.role === "admin" && (
              <Link className="button" href="/users/new">Add user</Link>
            )}
          </div>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <section className="panel">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Name</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Email</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Role</th>
              <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Status</th>
              {authUser?.role === "admin" && (
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{user.name}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }} className="mono">{user.email}</td>
                <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                  <span className={`badge ${user.role === "admin" ? "success" : user.role === "sales_approver" ? "success" : "dark"}`}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                  <span className={`badge ${user.isActive ? "success" : ""}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                {authUser?.role === "admin" && (
                  <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                    {user.isActive ? (
                      <button
                        className="button-ghost"
                        type="button"
                        disabled={working === user.id}
                        onClick={() => void handleDeactivate(user.id, user.name)}
                      >
                        {working === user.id ? "..." : "Deactivate"}
                      </button>
                    ) : (
                      <button
                        className="button-ghost"
                        type="button"
                        disabled={working === user.id}
                        onClick={() => void handleReactivate(user.id, user.name)}
                      >
                        {working === user.id ? "..." : "Reactivate"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <div className="empty">No users found.</div>}
      </section>
    </main>
  );
}
