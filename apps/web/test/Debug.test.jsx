import { describe, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { PaymentDashboard } from "../src/features/payments/PaymentDashboard.jsx";
import { AuthProvider } from "../src/app/AuthContext.jsx";
import { authApi } from "../src/lib/apiClient.js";
import { ToastProvider } from "../src/components/ui/Toast.jsx";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const merchantAuth = {
  user: { displayName: "Demo Merchant", email: "demo.merchant@example.com" },
  membership: { role: "MERCHANT", status: "ACTIVE", merchant: { name: "Northwind Commerce" } },
  merchant: { name: "Northwind Commerce" },
  permissions: ["payments.read", "payments.create", "ledger.read"],
  isDemo: true,
};
describe("debug", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("renders button and opens dialog", async () => {
    vi.spyOn(authApi, "me").mockResolvedValue({ data: merchantAuth });
    fetchMock.mockImplementation((url) => {
      if (String(url).endsWith("/auth/me")) return jsonResponse({ data: merchantAuth });
      if (String(url).includes("/payments/summary")) return jsonResponse({ data: { statusCounts: {} } });
      if (String(url).includes("/payments") && String(url).includes("limit=50")) return jsonResponse({ data: { payments: [] } });
      return jsonResponse({}, 404);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/payments"]}>
            <ToastProvider><PaymentDashboard /></ToastProvider>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("Payment Operations");
    const btn = await screen.findByRole("button", { name: "Create Payment" });
    console.log("BUTTON FOUND", btn);
    await userEvent.click(btn);
    // wait a bit
    await new Promise(r => setTimeout(r, 200));
    console.log("DIALOG?", screen.getByRole("dialog", { hidden: true }));
    console.log("BODY HTML snippet:", document.body.innerHTML.slice(0, 2000));
  });
});
