"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { CustomerView, PaginatedResponse } from "@auto8/shared";

import { WorkspaceShell } from "../../components/workspace-shell";
import { deleteCustomer, getCustomers } from "../../lib/api";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function CustomersPage() {
  const authResult = useRequireAuth();
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PaginatedResponse<CustomerView> = await getCustomers(q || undefined, page, 20);
      setCustomers(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return;
    try {
      await deleteCustomer(id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete customer");
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell
      title="Customers"
      description="Address book for your RFQ customers."
      authUser={authResult.user}
      section="Customers"
    >
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search customers…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="input w-64"
        />
        <Link href="/customers/new" className="btn btn-primary ml-auto">
          + New Customer
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-muted">No customers found.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-accent-soft text-muted uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-accent-soft/40">
                    <td className="px-4 py-3 font-medium text-ink">
                      <Link href={`/customers/${c.id}`} className="hover:underline">
                        {c.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{c.contactName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/customers/${c.id}`} className="text-accent hover:underline mr-3">
                        Edit
                      </Link>
                      {authResult.user?.role === "admin" && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(c.id, c.companyName)}
                          className="text-red-500 hover:underline text-xs"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-muted">
            <span>{total} customer{total !== 1 ? "s" : ""}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn btn-secondary"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={customers.length < 20}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-secondary"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </WorkspaceShell>
  );
}
