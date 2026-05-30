"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ProductView } from "@auto8/shared";
import { getProduct, updateProduct, reactivateProduct, deleteProduct, updateProductMarkup } from "../../../lib/api";
import { WorkspaceShell } from "../../../components/workspace-shell";
import { useRequireAuth } from "../../../lib/use-require-auth";

export default function CatalogueEditPage() {
  const authResult = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [product, setProduct] = useState<ProductView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // form fields
  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [defaultMarkup, setDefaultMarkup] = useState("0");
  const [settingMarkup, setSettingMarkup] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getProduct(id)
      .then((p: ProductView) => {
        setProduct(p);
        setProductCode(p.productCode);
        setProductName(p.productName);
        setDescription(p.description ?? "");
        setBrand(p.brand ?? "");
        setUnit(p.unit ?? "");
        setBasePrice(p.basePrice != null ? String(p.basePrice) : "");
        setCurrency(p.currency ?? "USD");
        setDefaultMarkup(String(p.defaultMarkup ?? 0));
      })
      .catch(() => setError("Product not found."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!productCode.trim() || !productName.trim()) {
      setError("Product code and name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProduct(id, {
        productCode: productCode.trim(),
        productName: productName.trim(),
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        unit: unit.trim() || undefined,
        basePrice: basePrice !== "" ? parseFloat(basePrice) : undefined,
        currency: currency.trim() || undefined,
        defaultMarkup: defaultMarkup !== "" ? parseFloat(defaultMarkup) : undefined,
      });
      setSuccess("Product updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!product) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (product.isActive) {
        await deleteProduct(id);
        setProduct({ ...product, isActive: false });
        setSuccess("Product deactivated.");
      } else {
        const updated = await reactivateProduct(id);
        setProduct(updated);
        setSuccess("Product reactivated.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product status.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetMarkup = async () => {
    const markup = parseFloat(defaultMarkup);
    if (isNaN(markup) || markup < 0) {
      setError("Markup must be a non-negative number.");
      return;
    }
    setSettingMarkup(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProductMarkup(id, markup);
      setSuccess(`Markup set to ${markup}%.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set markup.");
    } finally {
      setSettingMarkup(false);
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;
  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  if (!product && !loading) return <div className="p-6 text-red-600">Product not found.</div>;

  return (
    <WorkspaceShell title="Edit Product" description="Update product details." authUser={authResult.user} section="Catalogue">
    <div className="p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <a href="/catalogue" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Catalogue
        </a>
        <h1 className="text-2xl font-bold">Edit Product</h1>
        {product && (
          <span
            className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${product.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
          >
            {product.isActive ? "Active" : "Inactive"}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded p-3 text-sm">{success}</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. pcs, kg, L"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="0.00"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="USD"
              maxLength={3}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Markup %
            <span className="ml-1 text-xs text-gray-400 font-normal">(used for suggested sell price)</span>
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min="0"
              step="0.1"
              value={defaultMarkup}
              onChange={(e) => setDefaultMarkup(e.target.value)}
              placeholder="0"
              className="w-32 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {authResult.user.role === "admin" && (
              <button
                type="button"
                onClick={() => void handleSetMarkup()}
                disabled={settingMarkup}
                className="px-3 py-2 text-sm rounded border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                {settingMarkup ? "Setting..." : "Set Markup"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={() => void handleToggleActive()}
          disabled={saving}
          className={`px-4 py-2 text-sm rounded border disabled:opacity-50 ${product?.isActive ? "border-red-300 text-red-600 hover:bg-red-50" : "border-green-300 text-green-600 hover:bg-green-50"}`}
        >
          {product?.isActive ? "Deactivate" : "Reactivate"}
        </button>
        {authResult.user.role === "admin" && (
          <button
            onClick={() => router.push(`/catalogue/default/enrich`)}
            className="px-4 py-2 text-sm rounded border border-purple-300 text-purple-600 hover:bg-purple-50"
          >
            Enrich with AI
          </button>
        )}
        <button
          onClick={() => router.push("/catalogue")}
          className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {product && product.categoryTags && product.categoryTags.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Category Tags</p>
          <div className="flex flex-wrap gap-1">
            {product.categoryTags.map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
    </WorkspaceShell>
  );
}
