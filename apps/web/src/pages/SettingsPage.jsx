
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  KeyRound,
  ShieldCheck,
  Sparkles,
  LogIn,
  LogOut,
  Check,
  Moon,
  Sun,
  FlaskConical,
} from "lucide-react";
import { useAuth } from "../app/AuthContext.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { authApi } from "../lib/apiClient.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Badge } from "../components/ui/Badge.jsx";
import { Switch } from "../components/ui/Switch.jsx";

const DEMO_ROLES = [
  { role: "MERCHANT", label: "Merchant" },
  { role: "ADMIN", label: "Admin" },
  { role: "DEVELOPER", label: "Developer" },
  { role: "RISK_ANALYST", label: "Risk Analyst" },
];

const ROLE_LABELS = {
  MERCHANT: "Merchant",
  ADMIN: "Administrator",
  DEVELOPER: "Developer",
  RISK_ANALYST: "Risk Analyst",
  AUDITOR: "Auditor",
  GUEST: "Guest",
};

function getTheme() {
  if (typeof window === "undefined") return "light";

  try {
    return localStorage.getItem("pratyaya-theme") === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="min-w-0 text-sm font-medium text-slate-900 dark:text-white">
        {children}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { auth, setAuth } = useAuth();
  const { addToast } = useToast();

  const [theme, setTheme] = useState(getTheme);
  const [switchingRole, setSwitchingRole] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const busyRef = useRef(false);
  const isBusy = switchingRole !== null || signingOut;

  const role = auth?.membership?.role ?? "GUEST";
  const roleLabel = ROLE_LABELS[role] ?? role;
  const merchantName =
    auth?.membership?.merchant?.name ??
    auth?.merchant?.name ??
    "Not assigned";

  useEffect(() => {
    const syncTheme = () => setTheme(getTheme());

    window.addEventListener("storage", syncTheme);
    window.addEventListener("pratyaya-theme-change", syncTheme);

    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("pratyaya-theme-change", syncTheme);
    };
  }, []);

  const handleThemeChange = (checked) => {
    const nextTheme = checked ? "dark" : "light";

    setTheme(nextTheme);
    document.documentElement.classList.toggle(
      "dark",
      nextTheme === "dark",
    );
    document.documentElement.style.colorScheme = nextTheme;

    try {
      localStorage.setItem("pratyaya-theme", nextTheme);
    } catch {
      return;
    }

    window.dispatchEvent(new Event("pratyaya-theme-change"));

    addToast({
      title: "Appearance updated",
      description: `${checked ? "Dark" : "Light"} mode enabled.`,
      variant: "success",
      duration: 2500,
    });
  };

  const handleSwitchRole = async (targetRole) => {
    if (busyRef.current || role === targetRole) return;

    busyRef.current = true;
    setSwitchingRole(targetRole);

    try {
      const response = await authApi.demo(targetRole);

      if (!response?.data) {
        throw new Error("Unable to start demo session.");
      }

      setAuth(response.data);

      addToast({
        title: "Demo role switched",
        description: `Now exploring as ${
          ROLE_LABELS[targetRole] ?? targetRole
        }.`,
        variant: "success",
        duration: 3000,
      });

      navigate("/", { replace: true });
    } catch (error) {
      addToast({
        title: "Role switch failed",
        description: error?.message ?? "Please try again.",
        variant: "error",
        duration: 4000,
      });
    } finally {
      busyRef.current = false;
      setSwitchingRole(null);
    }
  };

  const handleLogout = async () => {
    if (busyRef.current) return;

    busyRef.current = true;
    setSigningOut(true);

    try {
      await authApi.logout();
    } catch {
      addToast({
        title: "Remote logout unavailable",
        description: "Your local session has been cleared.",
        variant: "warning",
        duration: 4000,
      });
    } finally {
      setAuth(null);
      setSigningOut(false);
      busyRef.current = false;
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          Settings & Preferences
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your account, sandbox access, and appearance.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Session & Identity</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {auth ? (
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <User className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {auth.user?.displayName ??
                      auth.user?.email ??
                      "User"}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {auth.user?.email ?? "No email available"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                <div className="flex items-center gap-3">
                  <ShieldCheck
                    className="h-5 w-5 text-blue-600"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      Guest Mode
                    </p>
                    <p className="text-xs text-slate-500">
                      Explore with a demo role.
                    </p>
                  </div>
                </div>

                <Link
                  to="/login"
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Sign In
                </Link>
              </div>
            )}

            <div className="grid gap-5 border-t border-slate-200 pt-5 dark:border-slate-800 sm:grid-cols-2">
              <Detail label="Current Role">
                <Badge variant="default">{roleLabel}</Badge>
              </Detail>

              <Detail label="Merchant Scope">
                <span className="block truncate">{merchantName}</span>
              </Detail>

              <Detail label="Session Status">
                <Badge variant={auth ? "success" : "secondary"}>
                  {auth ? "Active" : "Guest"}
                </Badge>
              </Detail>

              <Detail label="Environment">
                <Badge variant="info">Sandbox Simulator</Badge>
              </Detail>
            </div>

            <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles
                  className="h-4 w-4 text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold">
                  Switch Demo Role
                </h2>
              </div>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Explore Pratyaya with different role-based permissions.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {DEMO_ROLES.map(({ role: targetRole, label }) => {
                  const isCurrent = auth && role === targetRole;
                  const isLoading = switchingRole === targetRole;

                  return (
                    <Button
                      key={targetRole}
                      type="button"
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      disabled={isBusy || Boolean(isCurrent)}
                      loading={isLoading}
                      onClick={() => handleSwitchRole(targetRole)}
                    >
                      {isCurrent && (
                        <Check
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      )}
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p
                    id="dark-mode-label"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    {theme === "dark" ? (
                      <Moon className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Sun className="h-4 w-4" aria-hidden="true" />
                    )}
                    Dark Mode
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Save your preferred appearance.
                  </p>
                </div>

                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={handleThemeChange}
                  aria-labelledby="dark-mode-label"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                </div>

                <div>
                  <p className="text-sm font-semibold">
                    {auth ? "Sign Out" : "Session Access"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {auth
                      ? "End your current session securely."
                      : "Sign in with your account credentials."}
                  </p>
                </div>
              </div>

              {auth ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={isBusy}
                  loading={signingOut}
                  onClick={handleLogout}
                >
                  {!signingOut && (
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                  )}
                  {signingOut ? "Signing out..." : "Sign Out"}
                </Button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign In
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About Pratyaya</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Pratyaya is a simulated payment reliability platform
            designed to demonstrate secure financial workflows,
            double-entry accounting, provider routing, and
            transaction integrity.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Milestone", "M10 — Full-Stack UI"],
              ["Environment", "Sandbox Simulator"],
              ["Data", "Synthetic Only"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  {label}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
            <FlaskConical
              className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Simulation only. Never enter real card numbers,
              banking credentials, or personal payment information.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;
