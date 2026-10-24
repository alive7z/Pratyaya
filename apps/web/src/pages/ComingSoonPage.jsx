import { Construction } from "lucide-react";
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
    <div className="mx-auto max-w-xl py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
        <Construction aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="eyebrow mt-5">Planned capability</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        {label} is not implemented yet
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
        This navigation entry is an honest preview of the product roadmap. M01
        contains foundation and connectivity behavior only.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Return to overview
      </Link>
    </div>
  );
}
