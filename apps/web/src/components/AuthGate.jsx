import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FlaskConical,
  ShieldCheck,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";
import { authApi } from "../lib/apiClient.js";
import { useAuth } from "../app/AuthContext.jsx";

const DEMO_ROLES = [
  ["ADMIN", "Admin", "Full access to routing, circuit breakers, and integrity"],
  ["MERCHANT", "Merchant", "Payments, ledger accounts, and refunds"],
  ["DEVELOPER", "Developer", "Webhooks, API keys, and provider monitor"],
  [
    "RISK_ANALYST",
    "Risk Analyst",
    "Risk rules, alerts, and transaction review",
  ],
];

export function AuthGate({
  title = "Authentication required",
  description = "This feature requires an active session or demo access to inspect simulation records.",
}) {
  const { setAuth } = useAuth();
  const [busyRole, setBusyRole] = useState(null);
  const [error, setError] = useState("");

  const handleDemo = async (role) => {
    setBusyRole(role);
    setError("");
    try {
      const response = await authApi.demo(role);
      setAuth(response.data);
    } catch (err) {
      setError(err.message || "Failed to start demo session");
    } finally {
      setBusyRole(null);
    }
  };

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-8 px-4">
      <div className="card text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {description}
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 text-left border-t border-slate-100 pt-6 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <FlaskConical className="h-4 w-4" />
            Quick 1-click sandbox access
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Select a demo role to immediately unlock and interact with this
            view:
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {DEMO_ROLES.map(([role, label, subtitle]) => (
              <button
                key={role}
                type="button"
                disabled={Boolean(busyRole)}
                onClick={() => handleDemo(role)}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:hover:border-blue-700 dark:hover:bg-blue-950/20 disabled:opacity-50"
              >
                <div className="flex items-center justify-between w-full font-semibold text-sm text-slate-900 dark:text-white">
                  <span>Explore as {label}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                </div>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {busyRole === role ? "Starting session…" : subtitle}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
          <button
            type="button"
            onClick={handleGoBack}
            className="btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back to previous page
          </button>
          <Link to="/login" className="btn-secondary">
            <User className="h-4 w-4" />
            Sign in with account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AuthGate;
