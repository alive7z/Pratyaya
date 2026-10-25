import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  FlaskConical,
  ShieldCheck,
  Shield,
  Store,
  Code2,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { authApi } from "../lib/apiClient.js";
import { useAuth } from "../app/AuthContext.jsx";
import { cn } from "../lib/utils.js";

const roles = [
  {
    value: "MERCHANT",
    label: "Merchant",
    description: "Manage payments, refunds, and ledger accounts.",
    icon: Store,
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Monitor infrastructure, routing, and system integrity.",
    icon: Shield,
  },
  {
    value: "DEVELOPER",
    label: "Developer",
    description: "Explore webhooks, API integrations, and providers.",
    icon: Code2,
  },
  {
    value: "RISK_ANALYST",
    label: "Risk Analyst",
    description: "Review transactions, risk rules, and alerts.",
    icon: ShieldAlert,
  },
];

const initialForm = {
  displayName: "",
  merchantName: "",
  email: "",
  password: "",
};

const inputClassName = cn(
  "mt-1.5 h-10 w-full rounded-lg border",
  "border-slate-300 bg-white px-3",
  "text-sm text-slate-900 shadow-sm",
  "placeholder:text-slate-400",
  "transition-colors duration-200",
  "focus:border-blue-500 focus:outline-none",
  "focus:ring-2 focus:ring-blue-500/20",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "dark:border-slate-700 dark:bg-slate-900",
  "dark:text-slate-100 dark:placeholder:text-slate-500",
  "dark:focus:border-blue-400",
);

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const requestInProgress = useRef(false);

  const isRegister = mode === "register";
  const isBusy = busy !== null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (error) setError("");
  };

  const authenticate = async (request, busyKey) => {
    if (requestInProgress.current) return;

    requestInProgress.current = true;
    setBusy(busyKey);
    setError("");

    try {
      const response = await request();
      const session = response?.data;

      if (!session) {
        throw new Error("Unable to start your session. Please try again.");
      }

      setAuth(session);

      navigate("/", {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError?.message || "Something went wrong. Please try again.",
      );
    } finally {
      requestInProgress.current = false;
      setBusy(null);
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    const email = form.email.trim().toLowerCase();

    await authenticate(
      () =>
        isRegister
          ? authApi.register({
              displayName: form.displayName.trim(),
              merchantName: form.merchantName.trim(),
              email,
              password: form.password,
            })
          : authApi.login({
              email,
              password: form.password,
            }),
      "form",
    );
  };

  const explore = async (role) => {
    await authenticate(() => authApi.demo(role), role);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 sm:p-8">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <img
                src="/pratyaya.svg"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 rounded-xl object-cover"
              />
            </span>

            <span>
              <span className="block text-base font-bold tracking-tight">
                Pratyaya
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Payment reliability platform
              </span>
            </span>
          </Link>

          <div className="mt-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {isRegister ? "Create your account" : "Welcome back"}
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {isRegister
                ? "Create your workspace to explore simulated payment workflows."
                : "Sign in to access your payment reliability workspace."}
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {isRegister && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Display name
                  <input
                    type="text"
                    name="displayName"
                    autoComplete="name"
                    required
                    maxLength={100}
                    disabled={isBusy}
                    value={form.displayName}
                    onChange={(event) =>
                      updateField("displayName", event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Your name"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Merchant name
                  <input
                    type="text"
                    name="merchantName"
                    autoComplete="organization"
                    required
                    maxLength={120}
                    disabled={isBusy}
                    value={form.merchantName}
                    onChange={(event) =>
                      updateField("merchantName", event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Business name"
                  />
                </label>
              </div>
            )}

            <label className="block text-sm font-medium">
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={isBusy}
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className={inputClassName}
                placeholder="you@example.com"
              />
            </label>

            <label className="block text-sm font-medium">
              Password
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  minLength={isRegister ? 12 : 1}
                  required
                  disabled={isBusy}
                  value={form.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  className={cn(inputClassName, "pr-11")}
                  placeholder="Enter your password"
                />

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 mt-0.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </label>

            {isRegister && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your password must contain at least 12 characters.
              </p>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-blue-500 dark:focus-visible:ring-offset-slate-950"
            >
              {busy === "form" && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}

              {busy === "form"
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            {isRegister ? "Already have an account?" : "New to Pratyaya?"}{" "}
            <Link
              to={isRegister ? "/login" : "/register"}
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <FlaskConical className="h-5 w-5" aria-hidden="true" />
            </span>

            <div>
              <h2 className="text-base font-semibold">Explore the sandbox</h2>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                No credentials required
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Choose a demo role to explore Pratyaya's simulated payment
            infrastructure and role-based features.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {roles.map(({ value, label, description, icon: Icon }) => {
              const isLoading = busy === value;

              return (
                <button
                  key={value}
                  type="button"
                  disabled={isBusy}
                  aria-busy={isLoading}
                  onClick={() => explore(value)}
                  className="group flex min-h-32 flex-col rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-950/60 dark:group-hover:text-blue-400">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>

                    {isLoading ? (
                      <Loader2
                        className="h-4 w-4 animate-spin text-blue-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowRight
                        className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <span className="mt-3 text-sm font-semibold">
                    Explore as {label}
                  </span>

                  <span className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {isLoading ? "Opening sandbox..." : description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />

              <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                Simulation only. No real payments are processed. Never enter
                actual card, banking, or customer information.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
