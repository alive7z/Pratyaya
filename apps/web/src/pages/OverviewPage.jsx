
import { lazy, Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  Database,
  GitBranch,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Activity,
  CreditCard,
  ReceiptText,
  FlaskConical,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge.jsx";
import HealthSnapshot from "../features/health/HealthSnapshot.jsx";
import { useHealth } from "../hooks/useHealth.js";
import { API_DOCS_URL } from "../lib/apiClient.js";
import { cn } from "../lib/utils.js";

const DemoReliabilityChart = lazy(
  () => import("../features/overview/DemoReliabilityChart.jsx"),
);

const foundationItems = [
  {
    icon: LockKeyhole,
    title: "Authentication & Access Control",
    description:
      "MongoDB Atlas-backed identity, role-based permissions, merchant isolation, and secure session management.",
  },
  {
    icon: Layers3,
    title: "Reliable Payment APIs",
    description:
      "Idempotent payment creation, controlled state transitions, transaction history, and durable outbox events.",
  },
  {
    icon: GitBranch,
    title: "Double-Entry Ledger",
    description:
      "Immutable financial journals with balanced debit and credit entries for simulated captures and refunds.",
  },
  {
    icon: ShieldCheck,
    title: "Ledger Integrity Guardian",
    description:
      "Financial consistency checks for journal balances, references, duplicate entries, and refund limits.",
  },
  {
    icon: Database,
    title: "Reconciliation",
    description:
      "Compare internal payment records with synthetic provider data to identify mismatches and discrepancies.",
  },
];

const upcomingItems = [
  "End-to-end distributed tracing across payment workflows",
  "Performance benchmarking and load testing",
  "Enhanced provider failure recovery and observability",
  "Expanded automated integration and reliability testing",
];

const quickLinks = [
  {
    title: "Payments",
    description: "Explore payment transactions and refunds",
    icon: CreditCard,
    to: "/payments",
  },
  {
    title: "Ledger",
    description: "Inspect accounts and financial journals",
    icon: ReceiptText,
    to: "/ledger",
  },
  {
    title: "System Health",
    description: "Monitor service availability and readiness",
    icon: Activity,
    to: "/health",
  },
];

const cardClass = cn(
  "rounded-xl border border-slate-200",
  "bg-white p-5 shadow-sm",
  "dark:border-slate-800 dark:bg-slate-950",
  "sm:p-6",
);

export default function OverviewPage() {
  const health = useHealth();

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <section className="grid items-start gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info" showDot={false}>
              Simulation only
            </StatusBadge>

            <StatusBadge tone="ready" showDot={false}>
              Milestone 10
            </StatusBadge>
          </div>

          <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Payment reliability, engineered from the ledger up.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
            Pratyaya is a simulated payment platform built to
            explore reliable financial systems, including
            idempotency, double-entry accounting, provider
            routing, circuit breakers, reconciliation, and
            human-authorized AI assistance.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/payments"
              className="btn-primary"
            >
              Explore Payments
              <ArrowRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Link>

            <Link
              to="/ledger"
              className="btn-secondary"
            >
              View Ledger
            </Link>

            <a
              href={API_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <BookOpen
                className="h-4 w-4"
                aria-hidden="true"
              />
              API Docs
            </a>
          </div>

          <p className="mt-5 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            All financial operations use synthetic data.
            No real money, card details, or banking
            credentials are processed.
          </p>
        </div>

        <aside
          className={cn(
            "rounded-xl border border-blue-200",
            "bg-blue-50 p-5",
            "dark:border-blue-900/60 dark:bg-blue-950/30",
            "sm:p-6",
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            <ShieldCheck
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Financial Integrity
          </p>

          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950 dark:text-white">
            Built for correctness
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Payment state changes, ledger journals, and
            outbox records are designed to remain
            consistent throughout simulated transactions.
          </p>

          <div className="mt-5 space-y-3 border-t border-blue-200 pt-5 dark:border-blue-900/60">
            {[
              "Balanced debit and credit entries",
              "Immutable posted journals",
              "Idempotent payment operations",
              "Verifiable ledger integrity checks",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2.5"
              >
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />

                <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section aria-label="Quick navigation">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            Quick Access
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Navigate to your primary workspaces.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {quickLinks.map(({ title, description, icon: Icon, to }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-4",
                "border-slate-200 bg-white",
                "transition-colors duration-200",
                "hover:border-blue-300 hover:bg-blue-50/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                "dark:border-slate-800 dark:bg-slate-950",
                "dark:hover:border-blue-800 dark:hover:bg-blue-950/20",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <Icon
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {title}
                </p>

                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              </div>

              <ArrowRight
                className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>

      <HealthSnapshot health={health} />

      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Loading reliability chart"
            className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
          />
        }
      >
        <DemoReliabilityChart />
      </Suspense>

      <section
        aria-label="Platform capabilities"
        className="grid gap-5 lg:grid-cols-2"
      >
        <div className={cardClass}>
          <p className="eyebrow">Platform Foundation</p>

          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950 dark:text-white">
            Core Capabilities
          </h2>

          <div className="mt-6 space-y-5">
            {foundationItems.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex items-start gap-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <Icon
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cn(cardClass, "flex flex-col")}>
          <p className="eyebrow">Roadmap</p>

          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950 dark:text-white">
            Observability & Reliability
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            The next development phase focuses on improving
            system visibility, failure recovery, and
            performance validation.
          </p>

          <ul className="mt-6 space-y-4">
            {upcomingItems.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-start gap-2.5">
                <FlaskConical
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />

                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Pratyaya operates in a sandbox environment
                  using synthetic payment data and simulated
                  financial workflows.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
