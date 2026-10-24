
import { Suspense, lazy } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Loader2 } from "lucide-react";

import Layout from "../components/Layout.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
import { useAuth } from "./AuthContext.jsx";

const OverviewPage = lazy(() =>
  import("../pages/OverviewPage.jsx")
);

const SystemHealthPage = lazy(() =>
  import("../pages/SystemHealthPage.jsx")
);

const AuthPage = lazy(() =>
  import("../pages/AuthPage.jsx")
);

const LedgerPage = lazy(() =>
  import("../pages/LedgerPage.jsx")
);

const ComingSoonPage = lazy(() =>
  import("../pages/ComingSoonPage.jsx")
);

const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage.jsx")
);

const SettingsPage = lazy(() =>
  import("../pages/SettingsPage.jsx").then((module) => ({
    default: module.SettingsPage,
  }))
);

const PaymentDashboard = lazy(() =>
  import("../features/payments/PaymentDashboard.jsx").then(
    (module) => ({
      default: module.PaymentDashboard,
    })
  )
);

const PaymentDetails = lazy(() =>
  import("../features/payments/PaymentDetails.jsx").then(
    (module) => ({
      default: module.PaymentDetails,
    })
  )
);

const RefundManagement = lazy(() =>
  import("../features/payments/RefundManagement.jsx").then(
    (module) => ({
      default: module.RefundManagement,
    })
  )
);

const ProviderMonitor = lazy(() =>
  import("../features/payments/ProviderMonitor.jsx").then(
    (module) => ({
      default: module.ProviderMonitor,
    })
  )
);

const ReliabilityLab = lazy(() =>
  import("../features/payments/ReliabilityLab.jsx").then(
    (module) => ({
      default: module.ReliabilityLab,
    })
  )
);

const WebhookExplorer = lazy(() =>
  import("../features/payments/WebhookExplorer.jsx").then(
    (module) => ({
      default: module.WebhookExplorer,
    })
  )
);

const ProviderOverview = lazy(() =>
  import("../features/payments/ProviderOverview.jsx").then(
    (module) => ({
      default: module.ProviderOverview,
    })
  )
);

const RoutingAnalytics = lazy(() =>
  import("../features/payments/RoutingAnalytics.jsx").then(
    (module) => ({
      default: module.RoutingAnalytics,
    })
  )
);

const RoutingPolicyConfig = lazy(() =>
  import("../features/payments/RoutingPolicyConfig.jsx").then(
    (module) => ({
      default: module.RoutingPolicyConfig,
    })
  )
);

const CircuitBreakerMonitor = lazy(() =>
  import("../features/payments/CircuitBreakerMonitor.jsx").then(
    (module) => ({
      default: module.CircuitBreakerMonitor,
    })
  )
);

const RoutingDecisionExplorer = lazy(() =>
  import("../features/payments/RoutingDecisionExplorer.jsx").then(
    (module) => ({
      default: module.RoutingDecisionExplorer,
    })
  )
);

const RiskAnalytics = lazy(() =>
  import("../features/risk/RiskAnalytics.jsx").then(
    (module) => ({
      default: module.RiskAnalytics,
    })
  )
);

const RiskRules = lazy(() =>
  import("../features/risk/RiskRules.jsx").then(
    (module) => ({
      default: module.RiskRules,
    })
  )
);

const TransactionReview = lazy(() =>
  import("../features/risk/TransactionReview.jsx").then(
    (module) => ({
      default: module.TransactionReview,
    })
  )
);

const AgentPay = lazy(() =>
  import("../features/agentpay/AgentPay.jsx").then(
    (module) => ({
      default: module.AgentPay,
    })
  )
);

const ChaosLab = lazy(() =>
  import("../features/chaos/ChaosLab.jsx").then(
    (module) => ({
      default: module.ChaosLab,
    })
  )
);

const TransactionTimeMachine = lazy(() =>
  import("../features/time-machine/TransactionTimeMachine.jsx").then(
    (module) => ({
      default: module.TransactionTimeMachine,
    })
  )
);

const ROUTES = {
  overview: "/",
  login: "/login",
  register: "/register",
  payments: "/payments",
  ledger: "/ledger",
  provider: "/provider",
  health: "/health",
  settings: "/settings",
};

function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50vh] w-full items-center justify-center"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
          <Loader2
            className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Loading page
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Preparing your workspace...
          </p>
        </div>
      </div>
    </div>
  );
}

function RouteBoundary({ children }) {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function PublicOnlyRoute({ children }) {
  const { auth, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (auth) {
    return (
      <Navigate
        to={ROUTES.overview}
        replace
      />
    );
  }

  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path={ROUTES.login}
          element={
            <RouteBoundary>
              <PublicOnlyRoute>
                <AuthPage mode="login" />
              </PublicOnlyRoute>
            </RouteBoundary>
          }
        />

        <Route
          path={ROUTES.register}
          element={
            <RouteBoundary>
              <PublicOnlyRoute>
                <AuthPage mode="register" />
              </PublicOnlyRoute>
            </RouteBoundary>
          }
        />

        <Route element={<Layout />}>
          <Route
            index
            element={
              <RouteBoundary>
                <OverviewPage />
              </RouteBoundary>
            }
          />

          <Route
            path="overview"
            element={
              <Navigate
                to={ROUTES.overview}
                replace
              />
            }
          />

          <Route
            path="payments"
            element={
              <RouteBoundary>
                <PaymentDashboard />
              </RouteBoundary>
            }
          />

          <Route
            path="payments/:paymentId"
            element={
              <RouteBoundary>
                <PaymentDetails />
              </RouteBoundary>
            }
          />

          <Route
            path="payments/:paymentId/refunds"
            element={
              <RouteBoundary>
                <RefundManagement />
              </RouteBoundary>
            }
          />

          <Route
            path="ledger"
            element={
              <RouteBoundary>
                <LedgerPage />
              </RouteBoundary>
            }
          />

          <Route
            path="provider"
            element={
              <RouteBoundary>
                <ProviderMonitor />
              </RouteBoundary>
            }
          />

          <Route
            path="providers"
            element={
              <RouteBoundary>
                <ProviderOverview />
              </RouteBoundary>
            }
          />

          <Route
            path="routing"
            element={
              <RouteBoundary>
                <RoutingAnalytics />
              </RouteBoundary>
            }
          />

          <Route
            path="routing/policy"
            element={
              <RouteBoundary>
                <RoutingPolicyConfig />
              </RouteBoundary>
            }
          />

          <Route
            path="routing/circuit-breakers"
            element={
              <RouteBoundary>
                <CircuitBreakerMonitor />
              </RouteBoundary>
            }
          />

          <Route
            path="routing/decisions"
            element={
              <RouteBoundary>
                <RoutingDecisionExplorer />
              </RouteBoundary>
            }
          />

          <Route
            path="risk"
            element={
              <RouteBoundary>
                <RiskAnalytics />
              </RouteBoundary>
            }
          />

          <Route
            path="risk/rules"
            element={
              <RouteBoundary>
                <RiskRules />
              </RouteBoundary>
            }
          />

          <Route
            path="risk/review"
            element={
              <RouteBoundary>
                <TransactionReview />
              </RouteBoundary>
            }
          />

          <Route
            path="reliability-lab"
            element={
              <RouteBoundary>
                <ReliabilityLab />
              </RouteBoundary>
            }
          />

          <Route
            path="webhooks"
            element={
              <RouteBoundary>
                <WebhookExplorer />
              </RouteBoundary>
            }
          />

          <Route
            path="agentpay"
            element={
              <RouteBoundary>
                <AgentPay />
              </RouteBoundary>
            }
          />

          <Route
            path="chaos"
            element={
              <RouteBoundary>
                <ChaosLab />
              </RouteBoundary>
            }
          />

          <Route
            path="time-machine"
            element={
              <RouteBoundary>
                <TransactionTimeMachine />
              </RouteBoundary>
            }
          />

          <Route
            path="analytics"
            element={
              <RouteBoundary>
                <ComingSoonPage />
              </RouteBoundary>
            }
          />

          <Route
            path="health"
            element={
              <RouteBoundary>
                <SystemHealthPage />
              </RouteBoundary>
            }
          />

          <Route
            path="settings"
            element={
              <RouteBoundary>
                <SettingsPage />
              </RouteBoundary>
            }
          />

          <Route
            path="*"
            element={
              <RouteBoundary>
                <NotFoundPage />
              </RouteBoundary>
            }
          />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
