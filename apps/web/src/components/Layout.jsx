import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CreditCard,
  FlaskConical,
  HeartPulse,
  Menu,
  Moon,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { API_DOCS_URL } from "../lib/apiClient.js";

const navigation = [
  { to: "/", label: "Overview", icon: Activity, end: true, available: true },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/ledger", label: "Ledger", icon: ReceiptText, available: true },
  { to: "/reliability-lab", label: "Reliability Lab", icon: FlaskConical },
  { to: "/agentpay", label: "AgentPay", icon: Bot },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/health", label: "System health", icon: HeartPulse, available: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

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
  const [theme, setTheme] = useState(initialTheme);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("pratyaya-theme", theme);
  }, [theme]);

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
          className={`${mobileOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 mt-[33px] w-72 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 lg:sticky lg:top-0 lg:flex lg:h-[calc(100vh-33px)]`}
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

          <nav aria-label="Primary" className="mt-6 flex-1 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navClass}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon aria-hidden="true" className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {!item.available ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    Planned
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <p className="font-semibold text-slate-900 dark:text-white">
              M04 ledger engine
            </p>
            <p className="mt-1 leading-5">
              Immutable journals and integrity verification.
            </p>
          </div>
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
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
