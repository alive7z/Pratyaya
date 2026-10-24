
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
    <section
      className="card min-w-0"
      aria-labelledby="demo-chart-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Interface Demonstration</p>
          <h2
            id="demo-chart-title"
            className="mt-2 text-xl font-bold tracking-tight text-slate-950 dark:text-white"
          >
            Reliability Outcome Preview
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Illustrative payment outcomes across different scenarios.
          </p>
        </div>

        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Demo Data
        </span>
      </div>

      <div
        className="mt-6 h-72 w-full min-w-0"
        role="img"
        aria-label="Illustrative chart comparing resolved and unknown payment outcomes under normal, timeout, and recovery scenarios."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={illustrativeData}
            barGap={6}
            barCategoryGap="28%"
            margin={{ top: 10, right: 10, left: -15, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#cbd5e1"
              strokeOpacity={0.5}
            />

            <XAxis
              dataKey="scenario"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#94a3b8" }}
              dy={10}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value) => `${value}%`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#94a3b8" }}
            />

            <Tooltip
              cursor={{ fill: "#94a3b8", fillOpacity: 0.08 }}
              formatter={(value, name) => [`${value}%`, name]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                fontSize: 12,
              }}
            />

            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{
                fontSize: 12,
                paddingTop: 16,
              }}
            />

            <Bar
              dataKey="resolved"
              name="Resolved"
              fill="#2563eb"
              radius={[5, 5, 0, 0]}
              maxBarSize={48}
            />

            <Bar
              dataKey="unknown"
              name="Unknown"
              fill="#f59e0b"
              radius={[5, 5, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Illustrative data only. Values do not represent actual payment
        records or measured system performance.
      </p>
    </section>
  );
}
