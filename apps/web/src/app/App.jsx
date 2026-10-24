import { Route, Routes } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import ComingSoonPage from "../pages/ComingSoonPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";
import OverviewPage from "../pages/OverviewPage.jsx";
import SystemHealthPage from "../pages/SystemHealthPage.jsx";
import AuthPage from "../pages/AuthPage.jsx";
import LedgerPage from "../pages/LedgerPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<AuthPage mode="login" />} />
      <Route path="register" element={<AuthPage mode="register" />} />
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="health" element={<SystemHealthPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        {[
          "payments",
          "reliability-lab",
          "agentpay",
          "analytics",
          "settings",
        ].map((path) => (
          <Route key={path} path={path} element={<ComingSoonPage />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
