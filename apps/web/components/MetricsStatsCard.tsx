interface Props {
  label: string;
  value: string | number;
  sub?: string;
}

export function MetricsStatsCard({ label, value, sub }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
