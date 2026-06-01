"use client";

import { SUPPORTED_CURRENCIES } from "@auto8/shared";

export interface LineItemDraft {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
  productId?: string;
}

export interface QuoteTemplateFormValues {
  name: string;
  description: string;
  headerNotes: string;
  paymentTerms: string;
  deliveryTerms: string;
  validityDays: string;
  currency: string;
  lineItems: LineItemDraft[];
}

interface Props {
  values: QuoteTemplateFormValues;
  onChange: (values: QuoteTemplateFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
}

export function emptyFormValues(): QuoteTemplateFormValues {
  return {
    name: "",
    description: "",
    headerNotes: "",
    paymentTerms: "",
    deliveryTerms: "",
    validityDays: "",
    currency: "USD",
    lineItems: [],
  };
}

export function QuoteTemplateForm({
  values,
  onChange,
  onSubmit,
  loading,
  submitLabel = "Save",
  onCancel,
  cancelLabel = "Cancel",
}: Props) {
  const set = <K extends keyof QuoteTemplateFormValues>(
    key: K,
    value: QuoteTemplateFormValues[K],
  ) => onChange({ ...values, [key]: value });

  const addLineItem = () =>
    set("lineItems", [
      ...values.lineItems,
      { description: "", quantity: 1, unitPrice: 0, sortOrder: values.lineItems.length },
    ]);

  const updateLineItem = (
    index: number,
    field: keyof LineItemDraft,
    value: string | number,
  ) =>
    set(
      "lineItems",
      values.lineItems.map((li, i) => (i === index ? { ...li, [field]: value } : li)),
    );

  const removeLineItem = (index: number) =>
    set(
      "lineItems",
      values.lineItems
        .filter((_, i) => i !== index)
        .map((li, i) => ({ ...li, sortOrder: i })),
    );

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-ink mb-1">Template Name *</label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            required
            placeholder="Standard Quote"
            className="input w-full"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-ink mb-1">Description</label>
          <input
            type="text"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Currency</label>
          <select
            value={values.currency}
            onChange={(e) => set("currency", e.target.value)}
            className="input w-full"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Validity (days)</label>
          <input
            type="number"
            min="1"
            value={values.validityDays}
            onChange={(e) => set("validityDays", e.target.value)}
            placeholder="30"
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Payment Terms</label>
          <input
            type="text"
            value={values.paymentTerms}
            onChange={(e) => set("paymentTerms", e.target.value)}
            placeholder="Net 30"
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Delivery Terms</label>
          <input
            type="text"
            value={values.deliveryTerms}
            onChange={(e) => set("deliveryTerms", e.target.value)}
            placeholder="EXW"
            className="input w-full"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-ink mb-1">Header Notes</label>
          <textarea
            value={values.headerNotes}
            onChange={(e) => set("headerNotes", e.target.value)}
            rows={2}
            className="input w-full"
          />
        </div>
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-ink">Line Items</h3>
          <button type="button" onClick={addLineItem} className="btn btn-secondary text-xs">
            + Add Line
          </button>
        </div>
        {values.lineItems.length === 0 ? (
          <p className="text-sm text-muted">No line items yet. Add one to pre-populate quotes.</p>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 mb-1 px-0.5">
              <span className="col-span-6 text-xs font-medium text-muted">Description</span>
              <span className="col-span-2 text-xs font-medium text-muted">Qty</span>
              <span className="col-span-3 text-xs font-medium text-muted">Unit Price</span>
              <span className="col-span-1" />
            </div>
            <div className="space-y-2">
              {values.lineItems.map((li, i) => (
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
                    onChange={(e) =>
                      updateLineItem(i, "quantity", parseInt(e.target.value, 10) || 1)
                    }
                    className="input col-span-2"
                    aria-label="Quantity"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={li.unitPrice}
                    onChange={(e) =>
                      updateLineItem(i, "unitPrice", parseFloat(e.target.value) || 0)
                    }
                    className="input col-span-3"
                    aria-label="Unit Price"
                  />
                  <button
                    type="button"
                    onClick={() => removeLineItem(i)}
                    className="col-span-1 text-red-500 hover:text-red-700 text-sm"
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}
