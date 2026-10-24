import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const illustrativeData = [
  { scenario: "Normal", resolved: 96, unknown: 4 },
  { scenario: "Timeout", resolved: 62, unknown: 38 },
  { scenario: "Recovery", resolved: 91, unknown: 9 },
];

export default function DemoReliabilityChart() {
  return (
    <section className="card" aria-labelledby="demo-chart-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Interface demonstration</p>
          <h2
            id="demo-chart-title"
            className="mt-2 text-xl font-bold tracking-tight"
          >
            Reliability outcome preview
          </h2>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Illustrative data — not backend records
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        This chart previews the planned analytics treatment. It does not claim
        observed payment or benchmark results.
      </p>
      <div
        className="mt-6 h-64 min-w-0"
        aria-label="Illustrative reliability outcomes chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={illustrativeData}
            margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis
              dataKey="scenario"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              domain={[0, 100]}
            />
            <Tooltip />
            <Bar
              dataKey="resolved"
              name="Resolved"
              fill="#2563eb"
              radius={[5, 5, 0, 0]}
            />
            <Bar
              dataKey="unknown"
              name="Unknown"
              fill="#f59e0b"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
