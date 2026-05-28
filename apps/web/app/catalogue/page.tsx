"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProductView, PaginatedResponse } from "@auto8/shared";
import { getProducts, deleteProduct } from "../../lib/api";

export default function CataloguePage() {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this product?")) return;
    try {
      await deleteProduct(id);
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deactivate product");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Product Catalogue</h1>
        <a
          href="/catalogue/upload"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          Upload Catalogue
        </a>
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
                  <th className="border px-3 py-2">Status</th>
                  <th className="border px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border px-3 py-4 text-center text-gray-500">
                      No products found. Upload a catalogue to get started.
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
                      <td className="border px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="border px-3 py-2">
                        {p.isActive && (
                          <button
                            onClick={() => void handleDelete(p.id)}
                            className="text-red-600 hover:underline text-xs"
                          >
                            Deactivate
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
  );
}
