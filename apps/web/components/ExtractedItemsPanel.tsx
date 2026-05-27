"use client";

import type { RfqExtractedItemView } from "@auto8/shared";

interface ExtractedItemsPanelProps {
  items: RfqExtractedItemView[];
}

export function ExtractedItemsPanel({ items }: ExtractedItemsPanelProps) {
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
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.partNumber ?? <span className="hint">—</span>}</td>
              <td>{item.description}</td>
              <td>{item.quantity !== null ? item.quantity : <span className="hint">—</span>}</td>
              <td>{item.unit ?? <span className="hint">—</span>}</td>
              <td>{Math.round(item.confidence * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
