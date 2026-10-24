import { lazy, Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  Database,
  FlaskConical,
  GitBranch,
  Layers3,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge.jsx";
import HealthSnapshot from "../features/health/HealthSnapshot.jsx";
import { useHealth } from "../hooks/useHealth.js";
import { API_DOCS_URL } from "../lib/apiClient.js";

const DemoReliabilityChart = lazy(
  () => import("../features/overview/DemoReliabilityChart.jsx"),
);

const foundationItems = [
  {
    icon: LockKeyhole,
    title: "Atlas-backed identity and RBAC",
    description:
      "Credential-free demo roles, rotating sessions, CSRF protection, merchant isolation, and server-enforced permissions.",
  },
  {
    icon: Layers3,
    title: "Payment API foundation",
    description:
      "Idempotent payment creation, conditional state changes, timeline events, and transactional outbox records.",
  },
  {
    icon: GitBranch,
    title: "Immutable double-entry ledger",
    description:
      "Balanced capture and refund journals post atomically with payment state, ledger events, and outbox work.",
  },
  {
    icon: ShieldCheck,
    title: "Ledger Integrity Guardian",
    description:
      "Merchant-scoped checks cover balance, references, currencies, duplicates, reversals, and refund limits.",
  },
  {
    icon: Database,
    title: "Synthetic reconciliation fixtures",
    description:
      "Provider comparison records are clearly labeled and never presented as live reconciliation evidence.",
  },
];

const nextMilestoneItems = [
  "Provider authorization and capture workflow through the isolated mock provider",
  "Signed webhook inbox, durable outbox leasing, and unknown-outcome recovery",
  "Live simulator reconciliation while retaining synthetic fixtures",
  "Broader failure, webhook, and end-to-end provider verification",
];

export default function OverviewPage() {
  const health = useHealth();

  return (
    <motion.div
      className="space-y-10 sm:space-y-14"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info" showDot={false}>
              <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
              Simulation only
            </StatusBadge>
            <StatusBadge tone="ready" showDot={false}>
              Milestone 10
            </StatusBadge>
          </div>

          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
            Payment reliability, engineered from the ledger up.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
            Pratyaya is a portfolio-grade simulated payment platform focused on
            correctness under failure: idempotency, durable operations,
            double-entry accounting, multi-provider routing, circuit breakers,
            reconciliation, and human-authorized AI assistance.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/payments" className="btn-primary">
              Payments dashboard
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link to="/ledger" className="btn-secondary">
              Explore ledger
            </Link>
            <Link to="/health" className="btn-secondary">
              System health
            </Link>
            <a href={API_DOCS_URL} className="btn-secondary">
              <BookOpen aria-hidden="true" className="h-4 w-4" />
              OpenAPI
            </a>
          </div>

          <p className="mt-5 max-w-2xl text-xs leading-5 text-slate-500">
            No real card numbers, bank credentials, or money. AgentPay is an
            authorization simulation and cannot execute a payment without an
            authenticated human approval.
          </p>
        </div>

        <aside className="card bg-linear-to-br from-blue-600 to-blue-800 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
            What this milestone proves
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            Financial effects that balance
          </h2>
          <p className="mt-3 text-sm leading-6 text-blue-50">
            Capture and refund fixtures update payment state, immutable
            journals, ledger events, and the transactional outbox together.
          </p>
          <div className="mt-6 space-y-3 border-t border-white/20 pt-5 text-sm text-blue-50">
            <p>Every journal balances debits and credits in one currency.</p>
            <p>
              Posted journals cannot be edited or deleted; corrections require
              compensating journals.
            </p>
            <p>
              Integrity checks report PASS, FAIL, or INCONCLUSIVE without
              mutating financial records.
            </p>
          </div>
        </aside>
      </section>

      <HealthSnapshot health={health} />

      <Suspense
        fallback={
          <div className="card h-80 animate-pulse bg-slate-100 dark:bg-slate-900" />
        }
      >
        <DemoReliabilityChart />
      </Suspense>

      <section
        className="grid gap-6 lg:grid-cols-2"
        aria-label="Milestone details"
      >
        <div className="card">
          <p className="eyebrow">Implemented now</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Correctness foundations
          </h2>
          <ul className="mt-5 space-y-4">
            {foundationItems.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                  <item.icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card flex flex-col">
          <p className="eyebrow">Next milestone</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Next — Production Observability & Benchmarks
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Multi-provider routing, circuit breakers, outbox leasing, and chaos
            engineering are verified. The next milestone delivers end-to-end
            distributed tracing and deployment benchmarks.
          </p>
          <ul className="mt-5 space-y-3">
            {nextMilestoneItems.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-sm leading-6 text-slate-600 dark:text-slate-300"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              Simulation environment:
            </span>{" "}
            All operations run in sandbox simulation mode. Real cardholder data,
            PAN, CVV, or real banking credentials are never processed.
          </div>
        </div>
      </section>
    </motion.div>
  );
}
