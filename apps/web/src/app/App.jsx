import { Route, Routes } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import ComingSoonPage from "../pages/ComingSoonPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";
import OverviewPage from "../pages/OverviewPage.jsx";
import SystemHealthPage from "../pages/SystemHealthPage.jsx";
import AuthPage from "../pages/AuthPage.jsx";
import LedgerPage from "../pages/LedgerPage.jsx";
import { PaymentDashboard } from "../features/payments/PaymentDashboard.jsx";
import { PaymentDetails } from "../features/payments/PaymentDetails.jsx";
import { RefundManagement } from "../features/payments/RefundManagement.jsx";
import { ProviderMonitor } from "../features/payments/ProviderMonitor.jsx";
import { ReliabilityLab } from "../features/payments/ReliabilityLab.jsx";
import { WebhookExplorer } from "../features/payments/WebhookExplorer.jsx";
import { ProviderOverview } from "../features/payments/ProviderOverview.jsx";
import { RoutingAnalytics } from "../features/payments/RoutingAnalytics.jsx";
import { RoutingPolicyConfig } from "../features/payments/RoutingPolicyConfig.jsx";
import { CircuitBreakerMonitor } from "../features/payments/CircuitBreakerMonitor.jsx";
import { RoutingDecisionExplorer } from "../features/payments/RoutingDecisionExplorer.jsx";
import { RiskAnalytics } from "../features/risk/RiskAnalytics.jsx";
import { RiskRules } from "../features/risk/RiskRules.jsx";
import { TransactionReview } from "../features/risk/TransactionReview.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<AuthPage mode="login" />} />
      <Route path="register" element={<AuthPage mode="register" />} />
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="health" element={<SystemHealthPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="payments" element={<PaymentDashboard />} />
        <Route path="payments/:paymentId" element={<PaymentDetails />} />
        <Route
          path="payments/:paymentId/refunds"
          element={<RefundManagement />}
        />
        <Route path="provider" element={<ProviderMonitor />} />
        <Route path="reliability-lab" element={<ReliabilityLab />} />
        <Route path="webhooks" element={<WebhookExplorer />} />
        <Route path="providers" element={<ProviderOverview />} />
        <Route path="routing" element={<RoutingAnalytics />} />
        <Route path="routing/policy" element={<RoutingPolicyConfig />} />
        <Route
          path="routing/circuit-breakers"
          element={<CircuitBreakerMonitor />}
        />
        <Route path="routing/decisions" element={<RoutingDecisionExplorer />} />
        <Route path="risk" element={<RiskAnalytics />} />
        <Route path="risk/rules" element={<RiskRules />} />
        <Route path="risk/review" element={<TransactionReview />} />
        {["agentpay", "analytics", "settings"].map((path) => (
          <Route key={path} path={path} element={<ComingSoonPage />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
