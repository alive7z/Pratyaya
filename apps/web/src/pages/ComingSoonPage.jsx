import { Construction, ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const labels = {
  "/payments": "Payments",
  "/ledger": "Ledger",
  "/reliability-lab": "Reliability Lab",
  "/agentpay": "AgentPay",
  "/analytics": "Analytics",
  "/settings": "Settings",
};

export default function ComingSoonPage() {
  const { pathname } = useLocation();
  const label = labels[pathname] ?? "Feature";

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Construction
            className="h-6 w-6"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Coming Soon
        </p>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
          {label} is on the way
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          We're working on bringing this feature to Pratyaya. It isn't available
          yet, but you can continue exploring the rest of the platform.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:hover:bg-blue-500"
          >
            Back to Overview
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go Back
          </button>
        </div>
      </section>
    </main>
  );
}
