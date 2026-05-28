"use client";

import { useState } from "react";
import type { RfqExtractedItemView } from "@auto8/shared";
import { updateExtractedItem } from "../lib/api";

interface ExtractedItemsPanelProps {
  rfqId: string;
  items: RfqExtractedItemView[];
  onItemUpdated?: (updated: RfqExtractedItemView) => void;
}

export function ExtractedItemsPanel({ rfqId, items: initialItems, onItemUpdated }: ExtractedItemsPanelProps) {
  const [items, setItems] = useState<RfqExtractedItemView[]>(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ description: string; partNumber: string; quantity: string; unit: string }>({
    description: "",
    partNumber: "",
    quantity: "",
    unit: "",
  });
  const [saving, setSaving] = useState(false);

  const startEdit = (item: RfqExtractedItemView) => {
    setEditingId(item.id);
    setEditForm({
      description: item.description,
      partNumber: item.partNumber ?? "",
      quantity: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : "",
      unit: item.unit ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (itemId: string) => {
    setSaving(true);
    try {
      const body: { description?: string; partNumber?: string; quantity?: number; unit?: string } = {};
      if (editForm.description) body.description = editForm.description;
      if (editForm.partNumber) body.partNumber = editForm.partNumber;
      if (editForm.quantity !== "") body.quantity = Number(editForm.quantity);
      if (editForm.unit) body.unit = editForm.unit;

      const updated = await updateExtractedItem(rfqId, itemId, body);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      setEditingId(null);
      onItemUpdated?.(updated);
    } catch {
      alert("Failed to update item.");
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0) {
    return (
      <section className="panel">
        <h3>AI Extracted Items</h3>
        <div className="empty">No extracted items. Items will appear here after AI extraction completes.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h3>AI Extracted Items</h3>
      <p className="panel-subtitle">Line items extracted from the RFQ body by AI. Review before using in the quote.</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Part Number</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Confidence</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) =>
            editingId === item.id ? (
              <tr key={item.id}>
                <td>
                  <input
                    value={editForm.partNumber}
                    onChange={(e) => setEditForm((f) => ({ ...f, partNumber: e.target.value }))}
                    className="input-sm"
                    placeholder="Part #"
                  />
                </td>
                <td>
                  <input
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    className="input-sm"
                    placeholder="Description"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="input-sm"
                    style={{ width: 70 }}
                    placeholder="Qty"
                  />
                </td>
                <td>
                  <input
                    value={editForm.unit}
                    onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                    className="input-sm"
                    style={{ width: 60 }}
                    placeholder="Unit"
                  />
                </td>
                <td>{Math.round(item.confidence * 100)}%</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => void saveEdit(item.id)}
                    disabled={saving}
                    className="btn btn-primary btn-sm"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  {" "}
                  <button onClick={cancelEdit} className="btn btn-sm">
                    Cancel
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={item.id}>
                <td>{item.partNumber ?? <span className="hint">—</span>}</td>
                <td>{item.description}</td>
                <td>{item.quantity !== null ? item.quantity : <span className="hint">—</span>}</td>
                <td>{item.unit ?? <span className="hint">—</span>}</td>
                <td>{Math.round(item.confidence * 100)}%</td>
                <td>
                  <button
                    onClick={() => startEdit(item)}
                    className="btn btn-sm"
                    title="Edit item"
                  >
                    ✎ Edit
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </section>
  );
}
