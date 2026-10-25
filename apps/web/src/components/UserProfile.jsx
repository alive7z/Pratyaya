import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/Dialog.jsx";
import { Button } from "./ui/Button.jsx";
import { useToast } from "./ui/Toast.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import { authApi } from "../lib/apiClient.js";
import { cn } from "../lib/utils.js";
import {
  LogOut,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Activity,
  Check,
  Loader2,
  Shield,
  Store,
  Code2,
  ShieldAlert,
} from "lucide-react";

const OVERVIEW_ROUTE = "/";

const DEMO_ROLES = [
  {
    value: "MERCHANT",
    label: "Merchant",
    icon: Store,
  },
  {
    value: "ADMIN",
    label: "Admin",
    icon: Shield,
  },
  {
    value: "DEVELOPER",
    label: "Developer",
    icon: Code2,
  },
  {
    value: "RISK_ANALYST",
    label: "Risk Analyst",
    icon: ShieldAlert,
  },
];

const ROLE_LABELS = {
  MERCHANT: "Merchant",
  ADMIN: "Administrator",
  DEVELOPER: "Developer",
  RISK_ANALYST: "Risk Analyst",
};

function getInitials(name) {
  if (!name || typeof name !== "string") return "U";

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function ProfileAvatar({ name, size = "default" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        "rounded-full bg-blue-600 text-white",
        "font-semibold shadow-sm",
        size === "large" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs",
      )}
    >
      {getInitials(name)}
    </div>
  );
}

export function UserProfile() {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [open, setOpen] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [busyRole, setBusyRole] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = auth?.user?.displayName || auth?.user?.email || "User";

  const role = auth?.membership?.role || "";
  const roleLabel = ROLE_LABELS[role] || role || "User";

  const organization =
    auth?.membership?.merchant?.name || (role === "ADMIN" ? "Platform" : "");

  const isBusy = busyRole !== null || loggingOut;

  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (isBusy && !nextOpen) return;

      setOpen(nextOpen);

      if (!nextOpen) {
        setShowRoleSwitcher(false);
      }
    },
    [isBusy],
  );

  const handleOverview = useCallback(() => {
    setOpen(false);
    setShowRoleSwitcher(false);

    navigate(OVERVIEW_ROUTE);
  }, [navigate]);

  const handleSwitchRole = useCallback(
    async (nextRole) => {
      if (isBusy || nextRole === role) return;

      const selectedRole = DEMO_ROLES.find((item) => item.value === nextRole);

      if (!selectedRole) return;

      setBusyRole(nextRole);

      try {
        const response = await authApi.demo(nextRole);
        const session = response?.data;

        if (!session) {
          throw new Error("Unable to create a demo session. Please try again.");
        }

        setAuth(session);

        setOpen(false);
        setShowRoleSwitcher(false);

        navigate(OVERVIEW_ROUTE, {
          replace: true,
        });

        addToast({
          title: "Demo role switched",
          description: `Now exploring as ${selectedRole.label}.`,
          variant: "success",
          duration: 3000,
        });
      } catch (error) {
        addToast({
          title: "Unable to switch role",
          description:
            error?.message || "Something went wrong. Please try again.",
          variant: "error",
          duration: 4000,
        });
      } finally {
        setBusyRole(null);
      }
    },
    [isBusy, role, setAuth, navigate, addToast],
  );

  const handleLogout = useCallback(async () => {
    if (isBusy) return;

    setLoggingOut(true);

    try {
      await authApi.logout();
    } catch {
      addToast({
        title: "Session ended locally",
        description:
          "The server could not confirm logout. Your local session has been cleared.",
        variant: "warning",
        duration: 4000,
      });
    } finally {
      setAuth(null);
      setOpen(false);
      setShowRoleSwitcher(false);
      setLoggingOut(false);

      navigate("/login", {
        replace: true,
      });
    }
  }, [isBusy, setAuth, navigate, addToast]);

  if (!auth) return null;

  return (
    <Dialog modal open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Open account profile"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "group inline-flex min-w-0 items-center gap-2.5",
            "rounded-xl border border-transparent px-2.5 py-1.5",
            "transition-colors duration-200",
            "hover:bg-slate-100",
            "dark:hover:bg-slate-800/70",
            "focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-blue-500",
            "focus-visible:ring-offset-2",
            "dark:focus-visible:ring-offset-slate-950",
          )}
        >
          <ProfileAvatar name={displayName} />

          <div className="hidden min-w-0 max-w-40 flex-col text-left sm:flex">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {displayName}
            </span>

            <span className="truncate text-xs text-slate-500 dark:text-slate-400">
              {roleLabel}
              {organization ? ` · ${organization}` : ""}
            </span>
          </div>

          <ChevronDown
            className={cn(
              "hidden h-4 w-4 shrink-0 text-slate-400",
              "transition-transform duration-200",
              "group-hover:text-slate-600",
              "dark:group-hover:text-slate-300",
              "sm:block",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (isBusy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isBusy) event.preventDefault();
        }}
        className={cn(
          "w-[calc(100%-2rem)] max-w-sm gap-0 overflow-hidden",
          "rounded-2xl p-0 shadow-2xl",
          "border-slate-200 bg-white",
          "dark:border-slate-800 dark:bg-slate-950",
        )}
      >
        <DialogHeader
          className={cn(
            "border-b border-slate-200 p-5",
            "dark:border-slate-800",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <ProfileAvatar name={displayName} size="large" />

            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="truncate text-base font-semibold leading-tight text-slate-950 dark:text-white">
                {displayName}
              </DialogTitle>

              <DialogDescription className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {roleLabel}
                {organization ? ` · ${organization}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {showRoleSwitcher ? (
          <div className="p-3">
            <div className="flex items-center gap-2 px-2 py-2">
              <button
                type="button"
                onClick={() => setShowRoleSwitcher(false)}
                disabled={isBusy}
                aria-label="Back to account menu"
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center",
                  "rounded-lg text-slate-500",
                  "transition-colors hover:bg-slate-100",
                  "dark:text-slate-400 dark:hover:bg-slate-800",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Switch demo role
                </h3>

                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Choose a role to explore
                </p>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              {DEMO_ROLES.map(({ value, label, icon: Icon }) => {
                const isCurrent = value === role;
                const isLoading = busyRole === value;

                return (
                  <button
                    key={value}
                    type="button"
                    disabled={isBusy || isCurrent}
                    onClick={() => handleSwitchRole(value)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "group flex w-full items-center gap-3",
                      "rounded-lg px-3 py-3 text-left",
                      "text-sm transition-colors duration-150",
                      "focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-blue-500",
                      isCurrent
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                      "disabled:cursor-not-allowed",
                      !isCurrent && isBusy && "opacity-50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isCurrent
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-400",
                      )}
                      aria-hidden="true"
                    />

                    <span className="min-w-0 flex-1 font-medium">{label}</span>

                    {isLoading ? (
                      <Loader2
                        className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400"
                        aria-hidden="true"
                      />
                    ) : isCurrent ? (
                      <span className="flex items-center gap-1 text-xs font-medium">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Current
                      </span>
                    ) : (
                      <ArrowRight
                        className={cn(
                          "h-4 w-4 text-slate-400",
                          "transition-transform duration-150",
                          "group-hover:translate-x-1",
                          "motion-reduce:transform-none",
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => setShowRoleSwitcher(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1 p-3">
            <DialogClose asChild>
              <button
                type="button"
                onClick={handleOverview}
                className={cn(
                  "flex w-full items-center gap-3",
                  "rounded-lg px-3 py-3 text-left",
                  "text-sm font-medium",
                  "bg-blue-50 text-blue-700",
                  "transition-colors hover:bg-blue-100",
                  "dark:bg-blue-950/30 dark:text-blue-300",
                  "dark:hover:bg-blue-950/50",
                  "focus-visible:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-blue-500",
                )}
              >
                <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />

                <span className="flex-1">Go to Overview</span>

                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </DialogClose>

            <button
              type="button"
              onClick={() => setShowRoleSwitcher(true)}
              className={cn(
                "flex w-full items-center gap-3",
                "rounded-lg px-3 py-3 text-left",
                "text-sm font-medium",
                "text-slate-700 dark:text-slate-200",
                "transition-colors hover:bg-slate-100",
                "dark:hover:bg-slate-800",
                "focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-blue-500",
              )}
            >
              <ArrowRight
                className="h-4 w-4 shrink-0 text-slate-400"
                aria-hidden="true"
              />

              <span className="flex-1">Switch Demo Role</span>
            </button>

            <div className="my-2 border-t border-slate-200 dark:border-slate-800" />

            <button
              type="button"
              onClick={handleLogout}
              disabled={isBusy}
              className={cn(
                "flex w-full items-center gap-3",
                "rounded-lg px-3 py-3 text-left",
                "text-sm font-medium",
                "text-red-600 dark:text-red-400",
                "transition-colors hover:bg-red-50",
                "dark:hover:bg-red-950/30",
                "focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-red-500",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {loggingOut ? (
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}

              <span className="flex-1">
                {loggingOut ? "Logging out..." : "Logout"}
              </span>
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
