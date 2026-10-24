import { useState } from "react";
import { ArrowRight, FlaskConical, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../lib/apiClient.js";
import { useAuth } from "../app/AuthContext.jsx";

const roles = [
  ["MERCHANT", "Merchant", "Explore accounts and journals"],
  ["ADMIN", "Admin", "Run integrity checks"],
  ["DEVELOPER", "Developer", "Inspect accounting references"],
  ["RISK_ANALYST", "Risk Analyst", "Investigate discrepancies"],
];

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    merchantName: "",
    email: "",
    password: "",
  });

  async function submit(event) {
    event.preventDefault();
    setBusy("form");
    setError("");
    try {
      const response =
        mode === "register"
          ? await authApi.register(form)
          : await authApi.login({
              email: form.email,
              password: form.password,
            });
      setAuth(response.data);
      navigate("/ledger");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(null);
    }
  }

  async function explore(role) {
    setBusy(role);
    setError("");
    try {
      const response = await authApi.demo(role);
      setAuth(response.data);
      navigate("/ledger");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-blue-600 p-2.5 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold">Pratyaya</p>
              <p className="text-xs text-slate-500">
                Synthetic financial systems lab
              </p>
            </div>
          </div>
          <h1 className="mt-8 text-3xl font-bold tracking-tight">
            {mode === "register" ? "Create your sandbox" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Real authentication for developers; credential-free demo access for
            portfolio exploration.
          </p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "register" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Display name
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5"
                    required
                    value={form.displayName}
                    onChange={(e) =>
                      setForm({ ...form, displayName: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-medium">
                  Merchant name
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5"
                    required
                    value={form.merchantName}
                    onChange={(e) =>
                      setForm({ ...form, merchantName: e.target.value })
                    }
                  />
                </label>
              </div>
            ) : null}
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                type="password"
                minLength={mode === "register" ? 12 : 1}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            ) : null}
            <button disabled={Boolean(busy)} className="btn-primary w-full">
              {busy === "form"
                ? "Please wait…"
                : mode === "register"
                  ? "Register"
                  : "Sign in"}
            </button>
          </form>
          <a
            className="subtle-link mt-4"
            href={mode === "register" ? "/login" : "/register"}
          >
            {mode === "register"
              ? "Already registered? Sign in"
              : "Create an account"}
          </a>
        </section>

        <section className="card">
          <div className="flex items-center gap-2 text-blue-700">
            <FlaskConical className="h-5 w-5" />
            <p className="font-semibold">Explore without credentials</p>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Short-lived backend-managed sessions use synthetic sandbox data
            only.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {roles.map(([role, label, description]) => (
              <button
                key={role}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => explore(role)}
                className="group rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-blue-950/30"
              >
                <span className="flex items-center justify-between font-semibold">
                  Explore as {label}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {busy === role ? "Opening sandbox…" : description}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">
            Never enter real card, bank, or customer information. Demo users
            cannot write journals or alter balances.
          </p>
        </section>
      </div>
    </main>
  );
}
