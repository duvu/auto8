"use client";

import { useState, useEffect, useCallback } from "react";
import type { BackgroundJobView, PaginatedResponse } from "@auto8/shared";
import { getJobs } from "../../lib/api";

export default function JobsPage() {
  const [jobs, setJobs] = useState<BackgroundJobView[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PaginatedResponse<BackgroundJobView> = await getJobs({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        page,
      });
      setJobs(res.data);
      setTotal(res.meta.total);
      setHasMore(res.meta.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusColor = (status: string) => {
    switch (status) {
      case "done": return "bg-green-100 text-green-700";
      case "failed": return "bg-red-100 text-red-700";
      case "running": return "bg-blue-100 text-blue-700";
      case "pending": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Background Jobs</h1>
        <button onClick={() => void load()} className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
          Refresh
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="done">Done</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">All types</option>
          <option value="attachment_parse">attachment_parse</option>
          <option value="item_match">item_match</option>
          <option value="sheet_export">sheet_export</option>
          <option value="rfq_extract">rfq_extract</option>
        </select>
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
                  <th className="border px-3 py-2">Type</th>
                  <th className="border px-3 py-2">Status</th>
                  <th className="border px-3 py-2">Attempts</th>
                  <th className="border px-3 py-2">Error</th>
                  <th className="border px-3 py-2">Created</th>
                  <th className="border px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border px-3 py-4 text-center text-gray-500">
                      No jobs found.
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => (
                    <tr key={j.id}>
                      <td className="border px-3 py-2 font-mono text-xs">{j.type}</td>
                      <td className="border px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${statusColor(j.status)}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="border px-3 py-2 text-center">{j.attempts}/{j.maxAttempts}</td>
                      <td className="border px-3 py-2 text-xs text-red-600 max-w-xs truncate">
                        {j.errorMessage ?? "—"}
                      </td>
                      <td className="border px-3 py-2 text-xs text-gray-500">
                        {new Date(j.createdAt).toLocaleString()}
                      </td>
                      <td className="border px-3 py-2 text-xs text-gray-500">
                        {new Date(j.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3 text-sm text-gray-600">
            <span>{total} total jobs</span>
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
