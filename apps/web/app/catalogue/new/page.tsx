"use client";

import { useState } from "react";
import { createProduct } from "../../../lib/api";
import { WorkspaceShell } from "../../../components/workspace-shell";
import { useRequireAuth } from "../../../lib/use-require-auth";

export default function NewProductPage() {
  const authResult = useRequireAuth();
  const [form, setForm] = useState({
    productCode: "",
    productName: "",
    description: "",
    brand: "",
    unit: "",
    basePrice: "",
    currency: "USD",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createProduct({
        productCode: form.productCode.trim(),
        productName: form.productName.trim(),
        description: form.description.trim() || undefined,
        brand: form.brand.trim() || undefined,
        unit: form.unit.trim() || undefined,
        basePrice: form.basePrice ? Number(form.basePrice) : undefined,
        currency: form.currency.trim() || "USD",
      });
      window.location.href = "/catalogue";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell title="New Product" description="Add a new product to the catalogue." authUser={authResult.user} section="Catalogue">
    <div className="p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <a href="/catalogue" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Catalogue
        </a>
        <h1 className="text-2xl font-bold">New Product</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="productCode"
            value={form.productCode}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2 w-full text-sm"
            placeholder="e.g. WH-BK-DISC-12"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="productName"
            value={form.productName}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2 w-full text-sm"
            placeholder="e.g. Brake Disc 12-inch"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={2}
            className="border rounded px-3 py-2 w-full text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <input
              type="text"
              name="brand"
              value={form.brand}
              onChange={handleChange}
              className="border rounded px-3 py-2 w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input
              type="text"
              name="unit"
              value={form.unit}
              onChange={handleChange}
              className="border rounded px-3 py-2 w-full text-sm"
              placeholder="e.g. each, kg, m"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Price</label>
            <input
              type="number"
              name="basePrice"
              value={form.basePrice}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="border rounded px-3 py-2 w-full text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input
              type="text"
              name="currency"
              value={form.currency}
              onChange={handleChange}
              className="border rounded px-3 py-2 w-full text-sm"
              placeholder="USD"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Product"}
          </button>
          <a href="/catalogue" className="border border-gray-400 rounded px-4 py-2 text-sm hover:bg-gray-50">
            Cancel
          </a>
        </div>
      </form>
    </div>
    </WorkspaceShell>
  );
}
