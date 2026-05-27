"use client";

import type { AuditLogView } from "@auto8/shared";

interface Props {
  logs: AuditLogView[];
}

export function AuditLogTable({ logs }: Props) {
  if (logs.length === 0) {
    return <p className="text-gray-500 text-sm">No audit logs found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Time</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Resource</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Resource ID</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Actor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                {new Date(log.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{log.action}</td>
              <td className="px-3 py-2">{log.resourceType}</td>
              <td className="px-3 py-2 font-mono text-xs truncate max-w-[160px]" title={log.resourceId}>
                {log.resourceId}
              </td>
              <td className="px-3 py-2 text-gray-500">{log.actorId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
