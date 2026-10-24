import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CreditCard,
  FlaskConical,
  HeartPulse,
  LogOut,
  Menu,
  Moon,
  ReceiptText,
  Server,
  Shield,
  ShieldCheck,
  Sun,
  X,
  Settings,
  User,
  Wifi,
  BrainCircuit,
  GitBranch,
  Zap,
  ListFilter,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Battery,
  TrendingUp,
} from "lucide-react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";
import { API_DOCS_URL, authApi } from "../lib/apiClient.js";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

const navigation = [
  {
    to: "/",
    label: "Overview",
    icon: Activity,
    end: true,
    available: true,
    permissions: [],
  },
  {
    to: "/payments",
    label: "Payments",
    icon: CreditCard,
    available: true,
    permissions: ["payments.read"],
  },
  {
    to: "/ledger",
    label: "Ledger",
    icon: ReceiptText,
    available: true,
    permissions: ["ledger.read"],
  },
  {
    to: "/provider",
    label: "Provider Monitor",
    icon: Server,
    available: true,
    permissions: ["system.health.read"],
  },
  {
    to: "/providers",
    label: "Providers",
    icon: BrainCircuit,
    available: true,
    permissions: ["system.health.read"],
  },
  {
    to: "/routing",
    label: "Routing Analytics",
    icon: GitBranch,
    available: true,
    permissions: ["reconciliation.read"],
  },
  {
    to: "/routing/policy",
    label: "Routing Policy",
    icon: BrainCircuit,
    available: true,
    permissions: ["system.health.read"],
  },
  {
    to: "/routing/circuit-breakers",
    label: "Circuit Breakers",
    icon: Zap,
    available: true,
    permissions: ["system.health.read"],
  },
  {
    to: "/routing/decisions",
    label: "Decision Explorer",
    icon: ListFilter,
    available: true,
    permissions: ["reconciliation.read"],
  },
  {
    to: "/risk",
    label: "Risk Analytics",
    icon: Shield,
    available: true,
    permissions: ["risk.dashboard.read"],
  },
  {
    to: "/risk/rules",
    label: "Risk Rules",
    icon: AlertTriangle,
    available: true,
    permissions: ["risk.dashboard.read"],
  },
  {
    to: "/risk/review",
    label: "Transaction Review",
    icon: ShieldAlert,
    available: true,
    permissions: ["risk.alerts.read"],
  },
  {
    to: "/reliability-lab",
    label: "Reliability Lab",
    icon: FlaskConical,
    available: true,
    permissions: ["system.health.read"],
  },
  {
    to: "/webhooks",
    label: "Webhooks",
    icon: Wifi,
    available: true,
    permissions: ["webhooks.read"],
  },
  {
    to: "/agentpay",
    label: "AgentPay",
    icon: Bot,
    available: true,
    permissions: ["agentpay.read"],
  },
  {
    to: "/chaos",
    label: "Chaos Lab",
    icon: Battery,
    available: true,
    permissions: ["system.health.read"],
  },
  {
    to: "/time-machine",
    label: "Transaction Time Machine",
    icon: Clock,
    available: true,
    permissions: ["payments.read"],
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: TrendingUp,
    available: true,
    permissions: ["payments.read"],
  },
  {
    to: "/health",
    label: "System Health",
    icon: HeartPulse,
    available: true,
    permissions: ["system.health.read"],
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    available: true,
    permissions: [],
  },
];

const ROLE_LABELS = {
  MERCHANT: "Merchant",
  ADMIN: "Admin",
  DEVELOPER: "Developer",
  RISK_ANALYST: "Risk Analyst",
  AUDITOR: "Auditor",
};

function navClass({ isActive }) {
  return [
    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
  ].join(" ");
}

function initialTheme() {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem("pratyaya-theme") === "dark"
    ? "dark"
    : "light";
}

export default function Layout() {
  const { auth, loading: authLoading, setAuth } = useAuth();
  const [theme, setTheme] = useState(initialTheme);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("pratyaya-theme", theme);
  }, [theme]);

  const permissions = new Set(auth?.permissions ?? []);
  const visibleNav = navigation.filter(
    (item) =>
      item.available &&
      item.permissions.every((value) => permissions.has(value)),
  );

  const roleLabel = ROLE_LABELS[auth?.membership?.role ?? ""] || "User";

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local identity even when the remote session is already gone.
    }
    setAuth(null);
    window.location.href = "/login";
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Loading session…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-blue-700 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <div className="border-b border-blue-100 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/40">
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-blue-800 dark:text-blue-200">
          <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span>
            Simulation only — never enter real card, bank, or personal payment
            data.
          </span>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-33px)]">
        <aside
          className={`${mobileOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 lg:sticky lg:top-0 lg:flex lg:h-dvh`}
        >
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <NavLink
              to="/"
              className="flex items-center gap-3"
              onClick={() => setMobileOpen(false)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-base font-bold tracking-tight">
                  Pratyaya
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Reliability platform
                </span>
              </span>
            </NavLink>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 lg:hidden"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          {auth ? (
            <div className="px-2 py-3 mb-4 rounded-xl border border-slate-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-950/10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <User className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {auth.user?.displayName || auth.user?.email || "User"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                    {roleLabel} •{" "}
                    {auth.membership?.merchant?.name || "Merchant"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-3 py-3 mb-4 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                    Guest Mode
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Credential-free
                  </p>
                </div>
                <Link
                  to="/login"
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}

          <nav
            aria-label="Primary"
            className="mt-2 flex-1 min-h-0 space-y-1 overflow-y-auto pr-1"
          >
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => navClass({ isActive })}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon aria-hidden="true" className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <p className="font-semibold text-slate-900 dark:text-white">
              M10 Full-Stack UI Integration
            </p>
            <p className="mt-1 leading-5">
              Polished fintech dashboard with role-based navigation, real-time
              APIs, and human-authorized AI assistance.
            </p>
          </div>

          {auth && (
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400 dark:hover:bg-red-950/20"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </button>
          )}
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 dark:border-slate-800 dark:text-slate-300 lg:hidden"
                  aria-label="Open navigation"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu aria-hidden="true" className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-sm font-semibold">Engineering console</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Synthetic environment
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={API_DOCS_URL}
                  className="btn-secondary hidden sm:inline-flex"
                >
                  API docs
                </a>
                <button
                  type="button"
                  className="btn-secondary px-3"
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  onClick={() =>
                    setTheme((current) =>
                      current === "dark" ? "light" : "dark",
                    )
                  }
                >
                  {theme === "dark" ? (
                    <Sun aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Moon aria-hidden="true" className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </header>

          <main
            id="main-content"
            className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
          >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
