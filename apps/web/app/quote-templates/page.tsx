"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { PaginatedResponse, QuoteTemplateView } from "@auto8/shared";

import { WorkspaceShell } from "../../components/workspace-shell";
import { deleteQuoteTemplate, getQuoteTemplates } from "../../lib/api";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function QuoteTemplatesPage() {
  const authResult = useRequireAuth("admin");
  const [templates, setTemplates] = useState<QuoteTemplateView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PaginatedResponse<QuoteTemplateView> = await getQuoteTemplates(q || undefined, page, 20);
      setTemplates(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await deleteQuoteTemplate(id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell
      title="Quote Templates"
      description="Reusable templates to speed up quote creation."
      authUser={authResult.user}
      section="Templates"
    >
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search templates…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="input w-64"
        />
        <Link href="/quote-templates/new" className="btn btn-primary ml-auto">
          + New Template
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted">No templates found.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-accent-soft text-muted uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Currency</th>
                  <th className="px-4 py-3 text-left">Line Items</th>
                  <th className="px-4 py-3 text-left">Validity</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-accent-soft/40">
                    <td className="px-4 py-3 font-medium text-ink">
                      <Link href={`/quote-templates/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{t.currency}</td>
                    <td className="px-4 py-3 text-muted">{t.lineItems.length}</td>
                    <td className="px-4 py-3 text-muted">{t.validityDays ? `${t.validityDays} days` : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/quote-templates/${t.id}`} className="text-accent hover:underline mr-3">
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDelete(t.id, t.name)}
                        className="text-red-500 hover:underline text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-muted">
            <span>{total} template{total !== 1 ? "s" : ""}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-secondary">
                Previous
              </button>
              <button type="button" disabled={templates.length < 20} onClick={() => setPage((p) => p + 1)} className="btn btn-secondary">
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </WorkspaceShell>
  );
}
