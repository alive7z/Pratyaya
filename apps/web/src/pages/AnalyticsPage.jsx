import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../app/AuthContext.jsx";
import { AuthGate } from "../components/AuthGate.jsx";
import { Badge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card.jsx";
import { SkeletonCard } from "../components/ui/Skeleton.jsx";
import { paymentsApi } from "../lib/apiClient.js";
import { formatMoney, formatTime } from "../lib/format.js";
import {
  analyzePayments,
  paymentWindow,
} from "../features/analytics/paymentAnalytics.js";

const selectClass =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200";
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  backgroundColor: "#0f172a",
  color: "#f8fafc",
};
const dateLabel = (value) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function Metric({ title, value, description, icon: Icon, tone = "blue" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-5 sm:pt-6">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 break-words text-2xl font-bold tracking-tight">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[tone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { auth } = useAuth();
  const [range, setRange] = useState(() => ({ days: 30, end: new Date() }));
  const [currency, setCurrency] = useState("USD");
  const window = useMemo(() => paymentWindow(range.days, range.end), [range]);
  const canRead = Boolean(auth?.permissions?.includes("payments.read"));
  const query = useQuery({
    queryKey: [
      "analytics-payments",
      auth?.user?.id ?? auth?.user?.email,
      auth?.merchantId,
      window.from,
      window.to,
    ],
    queryFn: () => paymentsApi.list({ ...window, limit: 100 }),
    enabled: canRead,
    staleTime: 30_000,
  });
  const records = query.data?.data ?? [];
  const analytics = analyzePayments(
    Array.isArray(records) ? records : [],
    currency,
    window,
  );

  if (!auth)
    return (
      <AuthGate
        title="Explore payment analytics"
        description="Sign in or start a demo session to explore payment performance in your workspace."
      />
    );
  if (!canRead)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics access required</CardTitle>
          <CardDescription>
            Your role does not have permission to read payment analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/" className="btn-secondary">
            Back to Overview
          </Link>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            Insights &amp; monitoring
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Analytics
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Understand your payment activity, outcomes, and captured volume.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Period
            <select
              className={selectClass}
              value={range.days}
              onChange={(event) =>
                setRange({ days: Number(event.target.value), end: new Date() })
              }
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Currency
            <select
              className={selectClass}
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </select>
          </label>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() =>
              setRange((current) => ({ ...current, end: new Date() }))
            }
          >
            <RefreshCw
              className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
        <span>
          Simulation data · {dateLabel(window.from.slice(0, 10))} –{" "}
          {dateLabel(window.to.slice(0, 10))} (UTC)
        </span>
        <span>
          {query.isFetching
            ? "Updating analytics…"
            : query.dataUpdatedAt
              ? `Updated ${formatTime(query.dataUpdatedAt)}`
              : "Waiting for data"}
        </span>
      </div>

      {records.length === 100 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Showing a sample of the latest 100 payments in this period. Metrics
          and charts reflect this sample; shorten the period for a narrower
          view.
        </div>
      )}

      {query.isError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          <p className="font-semibold">Unable to update analytics</p>
          <p className="mt-1">{query.error?.message ?? "Please try again."}</p>
          {query.data && (
            <p className="mt-1">
              Showing the last available snapshot for this period.
            </p>
          )}
          <Button
            className="mt-3"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {query.isPending ? (
        <div
          role="status"
          aria-label="Loading analytics"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[0, 1, 2, 3].map((item) => (
            <SkeletonCard key={item} />
          ))}
        </div>
      ) : query.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              title="Payments"
              value={analytics.total.toLocaleString()}
              description={`${formatMoney(analytics.volume, currency)} requested volume`}
              icon={CreditCard}
            />
            <Metric
              title="Gross captured"
              value={formatMoney(analytics.captured, currency)}
              description="Captured amount before refunds"
              icon={TrendingUp}
              tone="emerald"
            />
            <Metric
              title="Capture rate"
              value={analytics.captureRate}
              description={`${analytics.capturedCount} of ${analytics.total} payments reached capture`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <Metric
              title="Failed payments"
              value={analytics.failed.toLocaleString()}
              description="Payments currently in a failed state"
              icon={XCircle}
              tone="red"
            />
          </div>
          {!analytics.total ? (
            <Card>
              <CardContent className="flex flex-col items-center py-14 text-center sm:py-16">
                <span className="mb-4 rounded-2xl bg-blue-50 p-4 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <Activity className="h-7 w-7" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold">
                  No payments in this view
                </h2>
                <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                  Try another period or currency, or create a simulated payment
                  to start exploring your performance.
                </p>
                <Link to="/payments" className="btn-primary mt-5">
                  Explore Payments
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
                <Card className="min-w-0">
                  <CardHeader>
                    <CardTitle>Payment activity</CardTitle>
                    <CardDescription>
                      Daily payment counts by creation date, in UTC.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="text-blue-600 dark:text-blue-400">
                        ● Total payments
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ● Reached capture
                      </span>
                    </div>
                    <div
                      className="h-72 w-full"
                      role="img"
                      aria-label={`Daily payment activity: ${analytics.total} payments, ${analytics.capturedCount} reached capture`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={analytics.trend}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="analytics-total"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#3b82f6"
                                stopOpacity={0.22}
                              />
                              <stop
                                offset="100%"
                                stopColor="#3b82f6"
                                stopOpacity={0.01}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                            stroke="#94a3b8"
                            strokeOpacity={0.2}
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={dateLabel}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            minTickGap={35}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            labelFormatter={dateLabel}
                            contentStyle={tooltipStyle}
                            itemStyle={{ color: "#f8fafc" }}
                          />
                          <Area
                            type="linear"
                            dataKey="total"
                            name="Total payments"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            fill="url(#analytics-total)"
                            isAnimationActive={false}
                          />
                          <Area
                            type="linear"
                            dataKey="captured"
                            name="Reached capture"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="transparent"
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader>
                    <CardTitle>Payment outcomes</CardTitle>
                    <CardDescription>
                      Current lifecycle state of payments in this view.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="relative h-48"
                      role="img"
                      aria-label={analytics.outcomes
                        .map((item) => `${item.name}: ${item.count}`)
                        .join(", ")}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.outcomes.filter(
                              (item) => item.count,
                            )}
                            dataKey="count"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={82}
                            paddingAngle={3}
                            stroke="none"
                            isAnimationActive={false}
                          >
                            {analytics.outcomes
                              .filter((item) => item.count)
                              .map((item) => (
                                <Cell key={item.name} fill={item.color} />
                              ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            itemStyle={{ color: "#f8fafc" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold">
                          {analytics.total}
                        </span>
                        <span className="text-xs text-slate-500">payments</span>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-2.5">
                      {analytics.outcomes.map((item) => (
                        <li
                          key={item.name}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            {item.name}
                          </span>
                          <span className="font-medium">
                            {item.count}
                            <span className="ml-3 inline-block w-12 text-right text-xs text-slate-500">
                              {((item.count / analytics.total) * 100).toFixed(
                                0,
                              )}
                              %
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Volume breakdown</CardTitle>
                  <CardDescription>
                    Amounts for payments created in the selected period.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-5 sm:grid-cols-3">
                    {[
                      ["Requested volume", analytics.volume],
                      ["Refunded amount", analytics.refunded],
                      ["Net captured", analytics.net],
                    ].map(([title, value]) => (
                      <div
                        key={title}
                        className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900"
                      >
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {title}
                        </dt>
                        <dd className="mt-2 break-words text-xl font-semibold">
                          {formatMoney(value, currency)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Net captured is gross captured minus refunded amounts.
                    Captured outcomes include payments later refunded.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Recent payments</CardTitle>
                    <CardDescription className="mt-1">
                      Your latest activity in this view.
                    </CardDescription>
                  </div>
                  <Link
                    to="/payments"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400"
                  >
                    All payments
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">
                        Ten most recent payments matching the selected period
                        and currency
                      </caption>
                      <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <tr>
                          {["Payment", "Created (UTC)", "Amount", "Status"].map(
                            (label) => (
                              <th
                                key={label}
                                scope="col"
                                className="whitespace-nowrap px-3 pb-3 font-medium"
                              >
                                {label}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {analytics.payments.slice(0, 10).map((payment) => (
                          <tr
                            key={payment.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          >
                            <td className="px-3 py-4">
                              <Link
                                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                                to={`/payments/${payment.id}`}
                              >
                                {payment.reference ?? payment.id}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-slate-500 dark:text-slate-400">
                              {new Date(payment.createdAt).toLocaleString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "UTC",
                                },
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 font-medium">
                              {formatMoney(
                                payment.amountMinor,
                                payment.currency,
                              )}
                            </td>
                            <td className="px-3 py-4">
                              <Badge
                                variant={
                                  payment.status === "FAILED"
                                    ? "destructive"
                                    : payment.status === "CAPTURED"
                                      ? "success"
                                      : "secondary"
                                }
                              >
                                {payment.status.replaceAll("_", " ")}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Based on the latest {records.length} payments returned for this
            period, filtered to {currency}.{" "}
            {records.length === 100
              ? "The 100-payment limit has been reached; this is a recent sample, not a full-period total. Choose a shorter period for a narrower view. "
              : ""}
            Amounts are never combined across currencies. These are simulated
            transactions.
          </p>
        </>
      ) : null}
    </div>
  );
}
