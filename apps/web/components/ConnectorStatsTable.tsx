import type { IngestionRunStats } from "@auto8/shared";

interface Props {
  stats: IngestionRunStats[];
}

export function ConnectorStatsTable({ stats }: Props) {
  if (stats.length === 0) {
    return <p className="text-gray-500 text-sm">No connector data.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Connector</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Total Runs</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Imported</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Skipped</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Failed</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Avg Duration</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Error Rate</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Last Run</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {stats.map((s) => (
            <tr key={s.connectorName} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs font-medium">{s.connectorName}</td>
              <td className="px-3 py-2 text-right">{s.totalRuns}</td>
              <td className="px-3 py-2 text-right font-medium">{s.totalImported}</td>
              <td className="px-3 py-2 text-right text-gray-400">{s.totalSkipped}</td>
              <td className="px-3 py-2 text-right text-red-500">{s.totalFailed}</td>
              <td className="px-3 py-2 text-right text-gray-400">{s.avgDurationMs}ms</td>
              <td className="px-3 py-2 text-right">
                <span className={s.errorRatePercent > 0 ? "text-red-600" : "text-green-600"}>
                  {s.errorRatePercent}%
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : "—"}
                {s.lastRunStatus && (
                  <span className={`ml-1 text-xs ${s.lastRunStatus === "success" ? "text-green-600" : "text-red-600"}`}>
                    ({s.lastRunStatus})
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
