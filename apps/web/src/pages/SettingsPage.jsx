import { useState } from "react";
import { Link } from "react-router-dom";
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
import { User, Key, ShieldCheck, Sparkles, LogIn } from "lucide-react";

const DEMO_ROLES = [
  { role: "MERCHANT", label: "Merchant" },
  { role: "ADMIN", label: "Admin" },
  { role: "DEVELOPER", label: "Developer" },
  { role: "RISK_ANALYST", label: "Risk Analyst" },
];

export function SettingsPage() {
  const { auth, setAuth } = useAuth();
  const { addToast } = useToast();
  const [theme, setTheme] = useState(() =>
    typeof window !== "undefined"
      ? window.localStorage.getItem("pratyaya-theme") || "light"
      : "light",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(null);

  const role = auth?.membership?.role || "GUEST";
  const roleLabel =
    {
      MERCHANT: "Merchant",
      ADMIN: "Admin",
      DEVELOPER: "Developer",
      RISK_ANALYST: "Risk Analyst",
      AUDITOR: "Auditor",
      GUEST: "Guest",
    }[role] || role;

  const handleThemeChange = (val) => {
    setTheme(val);
    window.localStorage.setItem("pratyaya-theme", val);
    document.documentElement.classList.toggle("dark", val === "dark");
    addToast({
      title: "Theme updated",
      variant: "success",
      description: `Switched to ${val} mode`,
      duration: 3000,
    });
  };

  const handleSwitchRole = async (targetRole) => {
    setSwitchingRole(targetRole);
    try {
      const res = await authApi.demo(targetRole);
      setAuth(res.data);
      addToast({
        title: "Switched Role",
        variant: "success",
        description: `Now exploring sandbox as ${targetRole}`,
        duration: 3000,
      });
    } catch (err) {
      addToast({
        title: "Role Switch Failed",
        variant: "destructive",
        description: err.message || "Failed to switch demo role",
      });
    } finally {
      setSwitchingRole(null);
    }
  };

  const handleLogout = async () => {
    setIsSaving(true);
    try {
      await authApi.logout();
    } catch {
      // Clear session even if remote session is expired
    }
    setAuth(null);
    window.location.href = "/login";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings & Preferences
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Manage your session, sandbox demo role, and appearance preferences
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Session & Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {auth ? (
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {auth.user?.displayName || auth.user?.email}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {auth.user?.email || "No email on file"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                      Guest Exploration Mode
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Credential-free sandbox viewing. Select a role below to
                      simulate actions.
                    </p>
                  </div>
                </div>
                <Link
                  to="/login"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Sign In
                </Link>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  Current Role
                </span>
                <div>
                  <Badge variant="default" className="capitalize">
                    {roleLabel}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  Merchant Scope
                </span>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                  {auth?.merchant?.name || "Global Sandbox Merchant"}
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  Session State
                </span>
                <div>
                  <Badge variant={auth ? "success" : "secondary"}>
                    {auth ? "Active" : "Guest"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  Environment
                </span>
                <div>
                  <Badge variant="default">Sandbox Simulator</Badge>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Switch Sandbox Demo Role
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                1-click switch into any sandbox persona to test permissions and
                features:
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_ROLES.map(({ role: r, label }) => {
                  const isCurrent = auth?.membership?.role === r;
                  return (
                    <Button
                      key={r}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      disabled={switchingRole !== null}
                      onClick={() => handleSwitchRole(r)}
                    >
                      {switchingRole === r
                        ? "Switching…"
                        : isCurrent
                          ? `✓ ${label}`
                          : label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Dark Mode
                </span>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={() =>
                    handleThemeChange(theme === "dark" ? "light" : "dark")
                  }
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Toggle between light and dark themes. Your preference is saved
                locally across sessions.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {auth ? "Sign Out" : "Session Access"}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {auth
                    ? "End your current session and return to login"
                    : "Authenticate with dedicated merchant credentials"}
                </p>
              </div>
            </div>
            {auth ? (
              <Button
                variant="destructive"
                onClick={handleLogout}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? "Signing out…" : "Sign Out"}
              </Button>
            ) : (
              <Link to="/login" className="block w-full">
                <Button variant="outline" className="w-full">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About Pratyaya</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Pratyaya is a synthetic payment reliability simulator — never a
              real payment processor. All data, payments, and provider
              interactions are simulated for demonstration and testing.
            </p>
            <div className="grid gap-4 sm:grid-cols-3 text-xs">
              <div className="p-3 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60">
                <div className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
                  Milestone
                </div>
                <div className="text-gray-500 dark:text-slate-400">
                  M10 — Full-Stack UI
                </div>
              </div>
              <div className="p-3 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60">
                <div className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
                  Environment
                </div>
                <div className="text-gray-500 dark:text-slate-400">
                  Sandbox Simulator
                </div>
              </div>
              <div className="p-3 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60">
                <div className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
                  Data
                </div>
                <div className="text-gray-500 dark:text-slate-400">
                  Synthetic only
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Never enter real card numbers, bank credentials, or personal
              payment data. Demo users cannot write journals or alter balances
              without policy authorization.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;
