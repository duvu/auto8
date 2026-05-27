import type { IngestionRunView } from "@auto8/shared";

interface Props {
  runs: IngestionRunView[];
}

export function IngestionRunsTable({ runs }: Props) {
  if (runs.length === 0) {
    return <p className="text-gray-500 text-sm">No runs found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Time</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Connector</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Imported</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Skipped</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Failed</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Duration</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">
                {new Date(run.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{run.connectorName}</td>
              <td className="px-3 py-2 text-right">{run.imported}</td>
              <td className="px-3 py-2 text-right text-gray-400">{run.skipped}</td>
              <td className="px-3 py-2 text-right text-red-500">{run.failed}</td>
              <td className="px-3 py-2 text-right text-gray-400">{run.durationMs}ms</td>
              <td className="px-3 py-2">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  run.status === "success"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {run.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
