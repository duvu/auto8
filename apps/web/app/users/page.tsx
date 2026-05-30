"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { UserView } from "@auto8/shared";

import { deactivateUser, getUsers, updateUser } from "../../lib/api";
import { WorkspaceShell } from "../../components/workspace-shell";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function UsersPage() {
  const [users, setUsers] = useState<UserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const authResult = useRequireAuth("admin");

  useEffect(() => {
    if (authResult && !authResult.forbidden) {
      void loadUsers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResult?.forbidden]);

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
      await deactivateUser(id);
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

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  const authUser = authResult.user;

  return (
    <WorkspaceShell
      title="User Management"
      description="Manage system users, roles, and access."
      authUser={authUser}
      section="Users"
    >
      <div className="p-6">
        <div className="flex justify-end mb-4">
          {authUser?.role === "admin" && (
            <Link className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700" href="/users/new">
              Add user
            </Link>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded p-3 mb-4 text-sm">{success}</div>
        )}

        {loading ? (
          <div className="text-gray-500 text-sm">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="border px-3 py-2">Name</th>
                  <th className="border px-3 py-2">Email</th>
                  <th className="border px-3 py-2">Role</th>
                  <th className="border px-3 py-2">Status</th>
                  {authUser?.role === "admin" && (
                    <th className="border px-3 py-2">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border px-3 py-4 text-center text-gray-500">No users found.</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td className="border px-3 py-2">{user.name}</td>
                      <td className="border px-3 py-2 font-mono text-xs">{user.email}</td>
                      <td className="border px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${user.role === "admin" ? "bg-purple-100 text-purple-700" : user.role === "sales_approver" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="border px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {authUser?.role === "admin" && (
                        <td className="border px-3 py-2">
                          {user.isActive ? (
                            <button
                              className="text-sm text-red-600 hover:underline disabled:opacity-50"
                              type="button"
                              disabled={working === user.id}
                              onClick={() => void handleDeactivate(user.id, user.name)}
                            >
                              {working === user.id ? "..." : "Deactivate"}
                            </button>
                          ) : (
                            <button
                              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
