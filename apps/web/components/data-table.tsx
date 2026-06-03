'use client';
import { useState, type ReactNode } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => ReactNode;
}

export interface RowAction<T> {
  label: string;
  onClick: (row: T) => void;
  danger?: boolean;
}

interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  rowActions?: RowAction<T>[];
  selectable?: boolean;
  bulkActions?: Array<{ label: string; onClick: (ids: string[]) => void }>;
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  columns, rows, onRowClick, rowActions, selectable, bulkActions, emptyMessage = 'No records found.'
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const toggleAll = () => {
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));
  };
  const toggleRow = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div>
      {/* Bulk action bar */}
      {selectable && selected.size > 0 && bulkActions && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#c9612c]/10 border border-[#c9612c]/20 rounded-lg mb-2">
          <span className="text-sm font-medium text-[#111827]">{selected.size} selected</span>
          {bulkActions.map(a => (
            <button key={a.label} onClick={() => { a.onClick(Array.from(selected)); setSelected(new Set()); }}
              className="text-sm px-3 py-1 rounded-md bg-[#c9612c] text-white hover:bg-[#b85526] transition-colors">
              {a.label}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-sm text-[#6b7280] hover:text-[#111827]">Clear</button>
        </div>
      )}
      {/* Table wrapper with sticky header */}
      <div className="overflow-x-auto overflow-y-auto rounded-lg border border-[#e5e7eb]" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table className="min-w-full divide-y divide-[#e5e7eb]">
          <thead className="bg-white sticky top-0 z-10 shadow-sm">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length}
                    onChange={toggleAll} className="rounded border-gray-300 text-[#c9612c]" />
                </th>
              )}
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-[#6b7280] uppercase tracking-wide"
                  style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
              {rowActions && <th className="w-12 px-3 py-3" />}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#e5e7eb]">
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                className="px-4 py-12 text-center text-sm text-[#6b7280]">{emptyMessage}</td></tr>
            ) : rows.map(row => (
              <tr key={row.id}
                className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${selected.has(row.id) ? 'bg-orange-50' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {selectable && (
                  <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)}
                      className="rounded border-gray-300 text-[#c9612c]" />
                  </td>
                )}
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-sm text-[#111827]">{col.render(row)}</td>
                ))}
                {rowActions && (
                  <td className="w-12 px-3 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                        className="p-1 rounded hover:bg-gray-100 text-[#6b7280]">⋮</button>
                      {openMenuId === row.id && (
                        <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg bg-white border border-[#e5e7eb] shadow-lg py-1">
                          {rowActions.map(a => (
                            <button key={a.label} onClick={() => { a.onClick(row); setOpenMenuId(null); }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${a.danger ? 'text-red-600' : 'text-[#111827]'}`}>
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
