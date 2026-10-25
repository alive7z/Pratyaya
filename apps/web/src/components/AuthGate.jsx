import { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FlaskConical,
  ShieldCheck,
  UserRound,
  Loader2,
  Shield,
  Store,
  Code2,
  ShieldAlert,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../lib/apiClient.js";
import { useAuth } from "../app/AuthContext.jsx";
import { cn } from "../lib/utils.js";

const DEMO_ROLES = [
  {
    role: "ADMIN",
    label: "Admin",
    description: "Manage routing, circuit breakers, and system integrity.",
    icon: Shield,
  },
  {
    role: "MERCHANT",
    label: "Merchant",
    description: "Manage payments, ledger accounts, and refunds.",
    icon: Store,
  },
  {
    role: "DEVELOPER",
    label: "Developer",
    description: "Explore webhooks, API keys, and provider monitoring.",
    icon: Code2,
  },
  {
    role: "RISK_ANALYST",
    label: "Risk Analyst",
    description: "Review risk rules, alerts, and transactions.",
    icon: ShieldAlert,
  },
];

const OVERVIEW_ROUTE = "/overview";

export function AuthGate({
  title = "Authentication required",
  description = "This feature requires an active session or demo access to inspect simulation records.",
}) {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const [busyRole, setBusyRole] = useState(null);
  const [error, setError] = useState("");

  const requestInProgress = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleDemo = useCallback(
    async (role) => {
      if (requestInProgress.current) return;

      requestInProgress.current = true;
      setBusyRole(role);
      setError("");

      try {
        const response = await authApi.demo(role);
        const session = response?.data;

        if (!session) {
          throw new Error("Unable to create a demo session. Please try again.");
        }

        if (!mountedRef.current) return;

        setAuth(session);

        navigate(OVERVIEW_ROUTE, {
          replace: true,
        });
      } catch (err) {
        if (!mountedRef.current) return;

        setError(
          err?.message || "Failed to start the demo session. Please try again.",
        );
      } finally {
        requestInProgress.current = false;

        if (mountedRef.current) {
          setBusyRole(null);
        }
      }
    },
    [setAuth, navigate],
  );

  const handleGoBack = useCallback(() => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <section
        aria-labelledby="auth-gate-title"
        className={cn(
          "overflow-hidden rounded-2xl border",
          "border-slate-200 bg-white shadow-sm",
          "dark:border-slate-800 dark:bg-slate-950",
        )}
      >
        <div className="px-5 pb-6 pt-8 text-center sm:px-8 sm:pt-10">
          <div
            className={cn(
              "mx-auto flex h-14 w-14 items-center justify-center",
              "rounded-2xl bg-blue-50 text-blue-600",
              "dark:bg-blue-950/50 dark:text-blue-400",
            )}
          >
            <ShieldCheck
              className="h-7 w-7"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <h1
            id="auth-gate-title"
            className={cn(
              "mt-5 text-2xl font-bold tracking-tight",
              "text-slate-950 dark:text-white",
              "sm:text-3xl",
            )}
          >
            {title}
          </h1>

          <p
            className={cn(
              "mx-auto mt-3 max-w-lg",
              "text-sm leading-relaxed",
              "text-slate-600 dark:text-slate-400",
            )}
          >
            {description}
          </p>
        </div>

        {error && (
          <div className="px-5 pb-5 sm:px-8">
            <div
              role="alert"
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3.5",
                "border-red-200 bg-red-50 text-red-800",
                "dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
              )}
            >
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />

              <p className="text-sm leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        <div
          className={cn(
            "border-t border-slate-200 px-5 py-6",
            "dark:border-slate-800",
            "sm:px-8 sm:py-8",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center",
                "rounded-lg bg-blue-50 text-blue-600",
                "dark:bg-blue-950/40 dark:text-blue-400",
              )}
            >
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
            </div>

            <h2
              className={cn(
                "text-sm font-semibold",
                "text-slate-900 dark:text-slate-100",
              )}
            >
              Explore the sandbox
            </h2>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Choose a role to explore Pratyaya with role-specific access and
            permissions.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {DEMO_ROLES.map(
              ({ role, label, description: subtitle, icon: Icon }) => {
                const isLoading = busyRole === role;
                const isDisabled = busyRole !== null;

                return (
                  <button
                    key={role}
                    type="button"
                    disabled={isDisabled}
                    aria-busy={isLoading}
                    onClick={() => handleDemo(role)}
                    className={cn(
                      "group relative flex min-h-32 flex-col",
                      "rounded-xl border p-4 text-left",
                      "border-slate-200 bg-white",
                      "transition-[border-color,background-color,box-shadow] duration-200",
                      "hover:border-blue-300 hover:bg-blue-50/50",
                      "hover:shadow-sm",
                      "focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-blue-500",
                      "focus-visible:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      "dark:border-slate-800 dark:bg-slate-900/40",
                      "dark:hover:border-blue-700",
                      "dark:hover:bg-blue-950/20",
                      "dark:focus-visible:ring-offset-slate-950",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center",
                          "rounded-lg bg-slate-100 text-slate-600",
                          "transition-colors duration-200",
                          "group-hover:bg-blue-100 group-hover:text-blue-600",
                          "dark:bg-slate-800 dark:text-slate-300",
                          "dark:group-hover:bg-blue-950/60",
                          "dark:group-hover:text-blue-400",
                        )}
                      >
                        <Icon
                          className="h-4 w-4"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </div>

                      {isLoading ? (
                        <Loader2
                          className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <ArrowRight
                          className={cn(
                            "h-4 w-4 text-slate-400",
                            "transition-transform duration-200",
                            "group-hover:translate-x-1",
                            "group-hover:text-blue-600",
                            "dark:group-hover:text-blue-400",
                            "motion-reduce:transform-none",
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="mt-3">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Explore as {label}
                      </h3>

                      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {isLoading ? "Starting your demo session..." : subtitle}
                      </p>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col gap-3 border-t px-5 py-5",
            "border-slate-200 bg-slate-50/50",
            "dark:border-slate-800 dark:bg-slate-900/30",
            "sm:flex-row sm:items-center sm:justify-between sm:px-8",
          )}
        >
          <button
            type="button"
            onClick={handleGoBack}
            disabled={busyRole !== null}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2",
              "rounded-lg border border-slate-200",
              "bg-white px-4 text-sm font-medium",
              "text-slate-700",
              "transition-colors duration-200",
              "hover:bg-slate-100",
              "focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-blue-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:border-slate-700 dark:bg-slate-900",
              "dark:text-slate-200 dark:hover:bg-slate-800",
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </button>

          <Link
            to="/login"
            aria-disabled={busyRole !== null}
            tabIndex={busyRole !== null ? -1 : undefined}
            onClick={(event) => {
              if (busyRole !== null) {
                event.preventDefault();
              }
            }}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2",
              "rounded-lg bg-blue-600 px-4",
              "text-sm font-medium text-white",
              "transition-colors duration-200",
              "hover:bg-blue-700",
              "focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-blue-500",
              "focus-visible:ring-offset-2",
              "dark:hover:bg-blue-500",
              busyRole !== null && "pointer-events-none opacity-50",
            )}
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Sign in with account
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <p className="mt-5 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Demo sessions operate in a simulated environment. No real payments or
        financial transactions are processed.
      </p>
    </main>
  );
}

export default AuthGate;
