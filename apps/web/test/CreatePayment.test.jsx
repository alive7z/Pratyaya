import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { PaymentDashboard } from "../src/features/payments/PaymentDashboard.jsx";
import { AuthProvider } from "../src/app/AuthContext.jsx";
import { authApi } from "../src/lib/apiClient.js";
import { ToastProvider } from "../src/components/ui/Toast.jsx";

const mockNavigate = vi.fn();
const fetchMock = vi.fn();

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const merchantAuth = {
  user: { displayName: "Demo Merchant", email: "demo.merchant@example.com" },
  membership: {
    role: "MERCHANT",
    status: "ACTIVE",
    merchant: { name: "Northwind Commerce" },
  },
  merchant: { name: "Northwind Commerce" },
  permissions: [
    "payments.read",
    "payments.create",
    "payments.cancel",
    "ledger.read",
  ],
  isDemo: true,
};

const nonCreateAuth = {
  ...merchantAuth,
  membership: { ...merchantAuth.membership, role: "RISK_ANALYST" },
  permissions: ["payments.read", "ledger.read", "risk.dashboard.read"],
};

function renderDashboard(authUser = merchantAuth) {
  vi.spyOn(authApi, "me").mockResolvedValue({ data: authUser });
  fetchMock.mockClear();
  fetchMock.mockImplementation((url) => {
    if (String(url).endsWith("/auth/me")) {
      return jsonResponse({ data: authUser });
    }
    if (String(url).includes("/payments/summary")) {
      return jsonResponse({ data: { statusCounts: {} } });
    }
    if (String(url).includes("/payments") && String(url).includes("limit=50")) {
      return jsonResponse({ data: { payments: [] } });
    }
    if (String(url).endsWith("/payments")) {
      return jsonResponse({
        data: {
          payment: {
            id: "pay_created_123",
            reference: "PAY-ABC",
            status: "CREATED",
          },
        },
      });
    }
    return jsonResponse({ error: { message: "not found" } }, 404);
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/payments"]}>
          <ToastProvider>
            <PaymentDashboard />
          </ToastProvider>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockNavigate.mockClear();
});

describe("Create Payment", () => {
  it("shows the + Create Payment button beside Refresh for a merchant", async () => {
    renderDashboard(merchantAuth);
    await screen.findByText("Payment Operations");
    // The button appears once the async auth session resolves.
    await screen.findByRole("button", { name: "Create Payment" });
  });

  it("does not show the Create Payment button for roles without create permission", async () => {
    renderDashboard(nonCreateAuth);
    await screen.findByText("Payment Operations");
    expect(
      screen.queryByRole("button", { name: "Create Payment" }),
    ).not.toBeInTheDocument();
  });

  async function openCreateDialog() {
    await userEvent.click(
      await screen.findByRole("button", { name: "Create Payment" }),
    );
    await screen.findByRole("dialog");
    return screen.getByRole("dialog");
  }

  it("creates a payment with idempotency key, refreshes, and opens the new payment", async () => {
    renderDashboard(merchantAuth);
    await screen.findByText("Payment Operations");

    const dialog = await openCreateDialog();

    await userEvent.click(within(dialog).getByLabelText(/Customer Reference/));
    await userEvent.type(
      within(dialog).getByLabelText(/Customer Reference/),
      "Acme Corp",
    );

    await userEvent.click(within(dialog).getByLabelText(/Amount/));
    await userEvent.type(within(dialog).getByLabelText(/Amount/), "500");

    await userEvent.click(within(dialog).getByLabelText("Order Reference"));
    await userEvent.type(
      within(dialog).getByLabelText("Order Reference"),
      "ORDER-123",
    );

    await userEvent.click(within(dialog).getByLabelText("Description"));
    await userEvent.type(
      within(dialog).getByLabelText("Description"),
      "Test payment",
    );

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create Payment" }),
    );

    await new Promise((r) => setTimeout(r, 50));

    const createCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith("/payments"),
    );
    expect(createCalls.length).toBe(1);
    const [, options] = createCalls[0];
    expect(options.method).toBe("POST");
    expect(options.headers["Idempotency-Key"]).toBeTruthy();
    const body = JSON.parse(options.body);
    expect(body.customerReference).toBe("Acme Corp");
    expect(body.amountMinor).toBe("50000");
    expect(body.currency).toBe("USD");
    expect(body.merchantReference).toBe("ORDER-123");
    expect(body.description).toBe("Test payment");

    expect(mockNavigate).toHaveBeenCalledWith("/payments/pay_created_123");
    await screen.findByText(/Payment created/i);
  });

  it("shows validation errors without calling the API", async () => {
    renderDashboard(merchantAuth);
    await screen.findByText("Payment Operations");

    const dialog = await openCreateDialog();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create Payment" }),
    );

    expect(
      screen.getByText("Customer reference is required."),
    ).toBeInTheDocument();

    const createCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith("/payments"),
    );
    expect(createCalls.length).toBe(0);
  });
});
