"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProductView, PaginatedResponse } from "@auto8/shared";
import {
  getProducts,
  deleteProduct,
  reactivateProduct,
  exportCatalogue,
} from "../../lib/api";
import { WorkspaceShell } from "../../components/workspace-shell";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function CataloguePage() {
  const authResult = useRequireAuth();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PaginatedResponse<ProductView> = await getProducts(q || undefined, page, 20);
      setProducts(res.data);
      setTotal(res.meta.total);
      setHasMore(res.meta.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this product?")) return;
    try {
      await deleteProduct(id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate product");
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await reactivateProduct(id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reactivate product");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportCatalogue();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "catalogue.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell title="Product Catalogue" description="Manage your product catalogue." authUser={authResult.user} section="Catalogue">
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Product Catalogue</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            className="border border-gray-400 text-gray-700 px-4 py-2 rounded hover:bg-gray-100 text-sm disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          {authResult.user.role === "admin" && (
            <a
              href="/catalogue/default/enrich"
              className="border border-purple-400 text-purple-600 px-4 py-2 rounded hover:bg-purple-50 text-sm"
            >
              Enrich with AI
            </a>
          )}
          <a
            href="/catalogue/new"
            className="border border-blue-600 text-blue-600 px-4 py-2 rounded hover:bg-blue-50 text-sm"
          >
            New Product
          </a>
          <a
            href="/catalogue/upload"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            Upload Catalogue
          </a>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search products..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 w-full max-w-md text-sm"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="border px-3 py-2">Code</th>
                  <th className="border px-3 py-2">Name</th>
                  <th className="border px-3 py-2">Brand</th>
                  <th className="border px-3 py-2">Unit</th>
                   <th className="border px-3 py-2">Base Price</th>
                   <th className="border px-3 py-2">Markup %</th>
                   <th className="border px-3 py-2">Tags</th>
                   <th className="border px-3 py-2">Status</th>
                   <th className="border px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                     <td colSpan={9} className="border px-3 py-8 text-center">
                      <p className="text-sm font-medium text-ink mb-1">No products yet</p>
                      <p className="text-xs text-muted mb-3">Upload a spreadsheet to bulk-import your product catalogue, or add products one by one.</p>
                      <div className="flex justify-center gap-3">
                        <a href="/catalogue/upload" className="text-xs font-medium text-accent underline hover:opacity-80">Upload catalogue →</a>
                        <a href="/catalogue/new" className="text-xs font-medium text-accent underline hover:opacity-80">Add product →</a>
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                     <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                       <td className="border px-3 py-2 font-mono text-xs">{p.productCode}</td>
                       <td className="border px-3 py-2">{p.productName}</td>
                       <td className="border px-3 py-2 text-gray-600">{p.brand ?? "—"}</td>
                       <td className="border px-3 py-2 text-gray-600">{p.unit ?? "—"}</td>
                       <td className="border px-3 py-2">
                         {p.basePrice != null ? `${p.currency} ${p.basePrice.toFixed(2)}` : "—"}
                       </td>
                       <td className="border px-3 py-2 text-gray-600">
                         {p.defaultMarkup > 0 ? `${p.defaultMarkup}%` : "—"}
                       </td>
                       <td className="border px-3 py-2">
                         {p.categoryTags && p.categoryTags.length > 0 ? (
                           <div className="flex flex-wrap gap-1">
                             {p.categoryTags.slice(0, 3).map((tag: string) => (
                               <span key={tag} className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                 {tag}
                               </span>
                             ))}
                             {p.categoryTags.length > 3 && (
                               <span className="text-xs text-gray-500">+{p.categoryTags.length - 3}</span>
                             )}
                           </div>
                         ) : (
                           <span className="text-gray-400">—</span>
                         )}
                       </td>
                      <td className="border px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="border px-3 py-2 space-x-2">
                        <a
                          href={`/catalogue/${p.id}`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Edit
                        </a>
                        {p.isActive ? (
                          <button
                            onClick={() => void handleDeactivate(p.id)}
                            className="text-red-600 hover:underline text-xs"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => void handleReactivate(p.id)}
                            className="text-green-600 hover:underline text-xs"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3 text-sm text-gray-600">
            <span>{total} total products</span>
            {page > 1 && (
              <button onClick={() => setPage(page - 1)} className="text-blue-600 hover:underline">
                Prev
              </button>
            )}
            <span>Page {page}</span>
            {hasMore && (
              <button onClick={() => setPage(page + 1)} className="text-blue-600 hover:underline">
                Next
              </button>
            )}
          </div>
        </>
      )}
    </div>
    </WorkspaceShell>
  );
}
