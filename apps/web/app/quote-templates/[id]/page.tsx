"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { QuoteTemplateView } from "@auto8/shared";
import { SUPPORTED_CURRENCIES } from "@auto8/shared";

import { WorkspaceShell } from "../../../components/workspace-shell";
import { getQuoteTemplate, updateQuoteTemplate } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/use-require-auth";

interface LineItemDraft {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
  productId?: string;
}

export default function EditQuoteTemplatePage() {
  const authResult = useRequireAuth("admin");
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [template, setTemplate] = useState<QuoteTemplateView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [validityDays, setValidityDays] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    getQuoteTemplate(params.id)
      .then((t) => {
        setTemplate(t);
        setName(t.name);
        setDescription(t.description ?? "");
        setHeaderNotes(t.headerNotes ?? "");
        setPaymentTerms(t.paymentTerms ?? "");
        setDeliveryTerms(t.deliveryTerms ?? "");
        setValidityDays(t.validityDays != null ? String(t.validityDays) : "");
        setCurrency(t.currency);
        setLineItems(
          t.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            sortOrder: li.sortOrder,
            productId: li.productId ?? undefined,
          }))
        );
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load template"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0, sortOrder: prev.length },
    ]);
  };

  const updateLineItem = (index: number, field: keyof LineItemDraft, value: string | number) => {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, [field]: value } : li)));
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index).map((li, i) => ({ ...li, sortOrder: i })));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      await updateQuoteTemplate(template.id, {
        name,
        description: description || undefined,
        headerNotes: headerNotes || undefined,
        paymentTerms: paymentTerms || undefined,
        deliveryTerms: deliveryTerms || undefined,
        validityDays: validityDays ? parseInt(validityDays, 10) : undefined,
        currency,
        lineItems,
      });
      router.push("/quote-templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!authResult) return null;
  if (authResult.forbidden) return <div className="p-6 text-red-600">Access Denied</div>;

  return (
    <WorkspaceShell
      title="Edit Template"
      description="Update quote template details and line items."
      authUser={authResult.user}
      section="Templates"
    >
      <div className="mb-4">
        <Link href="/quote-templates" className="text-sm text-muted hover:underline">
          ← Back to Templates
        </Link>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!loading && template && (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-ink mb-1">Template Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input w-full" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-ink mb-1">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input w-full">
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Validity (days)</label>
              <input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} placeholder="30" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Payment Terms</label>
              <input type="text" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Net 30" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Delivery Terms</label>
              <input type="text" value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} placeholder="EXW" className="input w-full" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-ink mb-1">Header Notes</label>
              <textarea value={headerNotes} onChange={(e) => setHeaderNotes(e.target.value)} rows={2} className="input w-full" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink">Line Items</h3>
              <button type="button" onClick={addLineItem} className="btn btn-secondary text-xs">
                + Add Line
              </button>
            </div>
            {lineItems.length === 0 ? (
              <p className="text-sm text-muted">No line items yet.</p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={li.description}
                      onChange={(e) => updateLineItem(i, "description", e.target.value)}
                      placeholder="Description"
                      className="input col-span-6"
                    />
                    <input
                      type="number"
                      min="1"
                      value={li.quantity}
                      onChange={(e) => updateLineItem(i, "quantity", parseInt(e.target.value, 10) || 1)}
                      className="input col-span-2"
                      title="Quantity"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={li.unitPrice}
                      onChange={(e) => updateLineItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="input col-span-3"
                      title="Unit Price"
                    />
                    <button
                      type="button"
                      onClick={() => removeLineItem(i)}
                      className="col-span-1 text-red-500 hover:text-red-700 text-sm"
                      title="Remove line"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : "Save Template"}
            </button>
            <Link href="/quote-templates" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </WorkspaceShell>
  );
}
