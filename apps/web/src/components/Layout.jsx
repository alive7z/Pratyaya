import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Activity,
  Bot,
  CreditCard,
  FlaskConical,
  HeartPulse,
  Menu,
  Moon,
  ReceiptText,
  Server,
  Shield,
  Sun,
  X,
  Settings,
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
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
} from "lucide-react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";
import { API_DOCS_URL } from "../lib/apiClient.js";
import { cn } from "../lib/utils.js";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import { UserProfile } from "./UserProfile.jsx";

const OVERVIEW_ROUTE = "/";

const navigation = [
  {
    to: OVERVIEW_ROUTE,
    label: "Overview",
    icon: Activity,
    end: true,
    permissions: [],
    section: "general",
  },
  {
    to: "/payments",
    label: "Payments",
    icon: CreditCard,
    permissions: ["payments.read"],
    section: "payments",
  },
  {
    to: "/ledger",
    label: "Ledger",
    icon: ReceiptText,
    permissions: ["ledger.read"],
    section: "payments",
  },
  {
    to: "/provider",
    label: "Provider Monitor",
    icon: Server,
    permissions: ["system.health.read"],
    section: "infrastructure",
  },
  {
    to: "/providers",
    label: "Providers",
    icon: BrainCircuit,
    permissions: ["system.health.read"],
    section: "infrastructure",
  },
  {
    to: "/routing",
    label: "Routing Analytics",
    icon: GitBranch,
    end: true,
    permissions: ["reconciliation.read"],
    section: "infrastructure",
  },
  {
    to: "/routing/policy",
    label: "Routing Policy",
    icon: BrainCircuit,
    permissions: ["system.health.read"],
    section: "infrastructure",
  },
  {
    to: "/routing/circuit-breakers",
    label: "Circuit Breakers",
    icon: Zap,
    permissions: ["system.health.read"],
    section: "infrastructure",
  },
  {
    to: "/routing/decisions",
    label: "Decision Explorer",
    icon: ListFilter,
    permissions: ["reconciliation.read"],
    section: "infrastructure",
  },
  {
    to: "/risk",
    label: "Risk Analytics",
    icon: Shield,
    end: true,
    permissions: ["risk.dashboard.read"],
    section: "risk",
  },
  {
    to: "/risk/rules",
    label: "Risk Rules",
    icon: AlertTriangle,
    permissions: ["risk.dashboard.read"],
    section: "risk",
  },
  {
    to: "/risk/review",
    label: "Transaction Review",
    icon: ShieldAlert,
    permissions: ["risk.alerts.read"],
    section: "risk",
  },
  {
    to: "/reliability-lab",
    label: "Reliability Lab",
    icon: FlaskConical,
    permissions: ["system.health.read"],
    section: "tools",
  },
  {
    to: "/webhooks",
    label: "Webhooks",
    icon: Wifi,
    permissions: ["webhooks.read"],
    section: "tools",
  },
  {
    to: "/agentpay",
    label: "AgentPay",
    icon: Bot,
    permissions: ["agentpay.read"],
    section: "tools",
  },
  {
    to: "/chaos",
    label: "Chaos Lab",
    icon: Battery,
    permissions: ["system.health.read"],
    section: "tools",
  },
  {
    to: "/time-machine",
    label: "Transaction Time Machine",
    icon: Clock,
    permissions: ["payments.read"],
    section: "tools",
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: TrendingUp,
    permissions: ["payments.read"],
    section: "analytics",
  },
  {
    to: "/health",
    label: "System Health",
    icon: HeartPulse,
    permissions: ["system.health.read"],
    section: "analytics",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    permissions: [],
    section: "settings",
  },
];

const navigationSections = [
  { id: "general", label: "Workspace" },
  { id: "payments", label: "Transactions" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "risk", label: "Risk Management" },
  { id: "tools", label: "Developer Tools" },
  { id: "analytics", label: "Insights & Monitoring" },
  { id: "settings", label: "Preferences" },
];

function getInitialTheme() {
  if (typeof window === "undefined") return "light";

  try {
    return window.localStorage.getItem("pratyaya-theme") === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function getInitialSidebarState() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem("pratyaya-sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

function NavigationItem({ item, collapsed = false, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex min-h-10 items-center gap-3",
          "rounded-lg px-3 py-2.5",
          "text-sm font-medium",
          "transition-colors duration-150",
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-blue-500",
          "focus-visible:ring-offset-2",
          "dark:focus-visible:ring-offset-slate-950",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "h-4.5 w-4.5 shrink-0",
              isActive
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200",
            )}
            strokeWidth={1.8}
            aria-hidden="true"
          />

          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>

              {isActive && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400"
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({
  mobileOpen,
  setMobileOpen,
  collapsed,
  setCollapsed,
  visibleNav,
  auth,
}) {
  const closeMobile = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={closeMobile}
          className={cn(
            "fixed inset-0 z-40 bg-slate-950/50",
            "backdrop-blur-[2px] lg:hidden",
          )}
        />
      )}

      <aside
        id="primary-sidebar"
        aria-label="Primary sidebar"
        data-collapsed={collapsed}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col",
          "border-r border-slate-200 bg-white",
          "dark:border-slate-800 dark:bg-slate-950",
          "transition-[transform,width] duration-200 ease-in-out",
          "lg:sticky lg:top-0 lg:z-40 lg:h-dvh",
          "lg:translate-x-0",
          collapsed ? "lg:w-19" : "lg:w-72",
          "w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex h-20 shrink-0 items-center",
            "border-b border-slate-100 px-4",
            "dark:border-slate-800",
            collapsed ? "lg:justify-center lg:px-2" : "justify-between",
          )}
        >
          <Link
            to={OVERVIEW_ROUTE}
            onClick={closeMobile}
            aria-label="Pratyaya overview"
            className={cn(
              "flex min-w-0 items-center gap-3",
              "rounded-lg focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-blue-500",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center",
                "rounded-xl bg-blue-600 text-white shadow-sm",
              )}
            >
              <img
                src="/pratyaya.svg"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 rounded-xl object-cover"
              />
            </span>

            <span className={cn("min-w-0", collapsed && "lg:hidden")}>
              <span className="block truncate text-base font-bold tracking-tight text-slate-950 dark:text-white">
                Pratyaya
              </span>

              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                Reliability platform
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={closeMobile}
            aria-label="Close navigation"
            className={cn(
              "ml-auto inline-flex h-9 w-9 items-center justify-center",
              "rounded-lg text-slate-500",
              "hover:bg-slate-100 dark:hover:bg-slate-800",
              "lg:hidden",
            )}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className={cn("flex min-h-0 flex-1 flex-col", "overflow-hidden")}>
          {!auth && (
            <div
              className={cn(
                "mx-3 mt-4 rounded-xl border border-dashed",
                "border-blue-200 bg-blue-50/60 p-3",
                "dark:border-blue-900 dark:bg-blue-950/20",
                collapsed && "lg:hidden",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                    Guest Mode
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Credential-free
                  </p>
                </div>

                <Link
                  to="/login"
                  onClick={closeMobile}
                  className={cn(
                    "shrink-0 rounded-lg bg-blue-600 px-3 py-1.5",
                    "text-xs font-semibold text-white",
                    "transition-colors hover:bg-blue-700",
                  )}
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}

          <nav
            aria-label="Primary navigation"
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              "overscroll-contain px-3 py-4",
              "scrollbar-thin",
              collapsed && "lg:px-2",
            )}
          >
            {navigationSections.map((section) => {
              const items = visibleNav.filter(
                (item) => item.section === section.id,
              );

              if (items.length === 0) return null;

              return (
                <div key={section.id} className="mb-5 last:mb-0">
                  <div
                    className={cn(
                      "mb-2 px-3 text-[10px] font-semibold",
                      "uppercase tracking-[0.12em]",
                      "text-slate-400 dark:text-slate-500",
                      collapsed && "lg:hidden",
                    )}
                  >
                    {section.label}
                  </div>

                  <div className="space-y-1">
                    {items.map((item) => (
                      <NavigationItem
                        key={item.to}
                        item={item}
                        collapsed={collapsed}
                        onNavigate={closeMobile}
                      />
                    ))}
                  </div>

                  {collapsed && (
                    <div className="mx-auto mt-4 hidden h-px w-8 bg-slate-200 dark:bg-slate-800 lg:block" />
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div
          className={cn(
            "shrink-0 border-t border-slate-200 p-3",
            "dark:border-slate-800",
          )}
        >
          <div
            className={cn(
              "rounded-xl border border-slate-200",
              "bg-slate-50 p-3",
              "dark:border-slate-800 dark:bg-slate-900/70",
              collapsed && "lg:hidden",
            )}
          >
            <div className="flex items-center gap-2">
              <FlaskConical
                className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />

              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Simulation Environment
              </p>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Explore payment reliability, routing, and risk workflows.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "mt-3 hidden h-10 w-full items-center gap-3",
              "rounded-lg px-3 text-sm font-medium",
              "text-slate-500 transition-colors",
              "hover:bg-slate-100 hover:text-slate-900",
              "dark:text-slate-400",
              "dark:hover:bg-slate-800 dark:hover:text-white",
              "lg:flex",
              collapsed && "justify-center px-2",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4.5 w-4.5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" />
            )}

            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function Header({ theme, toggleTheme, mobileOpen, setMobileOpen, auth }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30",
        "border-b border-slate-200",
        "bg-white/95 backdrop-blur-xl",
        "dark:border-slate-800 dark:bg-slate-950/95",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center justify-between gap-3",
          "px-4 sm:px-6 lg:px-8",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="primary-sidebar"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center",
              "rounded-lg border border-slate-200",
              "text-slate-600 transition-colors",
              "hover:bg-slate-100",
              "focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-blue-500",
              "dark:border-slate-800 dark:text-slate-300",
              "dark:hover:bg-slate-800",
              "lg:hidden",
            )}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <Link
            to={OVERVIEW_ROUTE}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex min-w-0 items-center gap-2",
              "rounded-lg focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-blue-500",
            )}
          >
            <img
              src="/pratyaya.svg"
              alt=""
              aria-hidden="true"
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-slate-950 dark:text-white">
                Pratyaya
              </p>

              <p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
                Reliability platform
              </p>
            </div>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={API_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "hidden h-9 items-center gap-2 rounded-lg",
              "border border-slate-200 px-3",
              "text-xs font-medium text-slate-700",
              "transition-colors hover:bg-slate-100",
              "dark:border-slate-800 dark:text-slate-300",
              "dark:hover:bg-slate-800",
              "sm:inline-flex",
            )}
          >
            API Docs
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center",
              "rounded-lg border border-slate-200",
              "text-slate-600 transition-colors",
              "hover:bg-slate-100",
              "focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-blue-500",
              "dark:border-slate-800 dark:text-slate-300",
              "dark:hover:bg-slate-800",
            )}
          >
            {theme === "dark" ? (
              <Sun className="h-4.5 w-4.5" aria-hidden="true" />
            ) : (
              <Moon className="h-4.5 w-4.5" aria-hidden="true" />
            )}
          </button>

          {auth && <UserProfile />}
        </div>
      </div>
    </header>
  );
}

function SessionLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-dvh items-center justify-center",
        "bg-slate-50 dark:bg-slate-950",
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center",
            "rounded-2xl bg-blue-50",
            "dark:bg-blue-950/40",
          )}
        >
          <Loader2
            className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Loading Pratyaya
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Preparing your workspace...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { auth, loading: authLoading } = useAuth();
  const location = useLocation();

  const [theme, setTheme] = useState(getInitialTheme);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialSidebarState);

  const permissions = auth?.permissions;

  const visibleNav = useMemo(() => {
    const permissionSet = new Set(
      Array.isArray(permissions) ? permissions : [],
    );

    return navigation.filter((item) =>
      item.permissions.every((permission) => permissionSet.has(permission)),
    );
  }, [permissions]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");

    document.documentElement.style.colorScheme = theme;

    try {
      window.localStorage.setItem("pratyaya-theme", theme);
    } catch {
      return;
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "pratyaya-sidebar-collapsed",
        String(collapsed),
      );
    } catch {
      return;
    }
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileOpen]);

  if (authLoading) {
    return <SessionLoading />;
  }

  return (
    <div
      className={cn(
        "min-h-dvh bg-slate-50 text-slate-900",
        "dark:bg-slate-950 dark:text-slate-100",
      )}
    >
      <a
        href="#main-content"
        className={cn(
          "sr-only z-100 rounded-lg",
          "bg-blue-600 px-4 py-2 text-sm font-medium text-white",
          "focus:not-sr-only focus:fixed focus:left-4 focus:top-4",
        )}
      >
        Skip to content
      </a>

      <div
        className={cn(
          "relative z-10 flex min-h-9 items-center justify-center",
          "border-b border-blue-100 bg-blue-50",
          "px-4 py-2",
          "dark:border-blue-900/60 dark:bg-blue-950/40",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center gap-2",
            "text-center text-xs font-medium leading-relaxed",
            "text-blue-800 dark:text-blue-200",
          )}
        >
          <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />

          <span>
            Simulation only — never enter real card, bank, or personal payment
            data.
          </span>
        </div>
      </div>

      <div className="flex min-h-[calc(100dvh-36px)]">
        <Sidebar
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          visibleNav={visibleNav}
          auth={auth}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Header
            theme={theme}
            toggleTheme={toggleTheme}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            auth={auth}
          />

          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              "mx-auto w-full max-w-[1600px] flex-1",
              "min-w-0 px-4 py-6",
              "sm:px-6 sm:py-8 lg:px-8",
            )}
          >
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
