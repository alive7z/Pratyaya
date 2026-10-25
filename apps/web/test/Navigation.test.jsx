import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import AuthPage from "../src/pages/AuthPage.jsx";
import { AuthProvider } from "../src/app/AuthContext.jsx";
import { authApi } from "../src/lib/apiClient.js";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function authPayload(role, merchantName) {
  return {
    data: {
      user: {
        displayName: `Demo ${role}`,
        email: `demo.${role.toLowerCase().replaceAll("_", "-")}@example.com`,
      },
      membership: {
        role,
        status: "ACTIVE",
        merchant: { name: merchantName },
      },
      merchant: { name: merchantName },
      permissions: ["payments.read", "payments.create", "ledger.read"],
      isDemo: true,
    },
    meta: { requestId: "nav-test" },
  };
}

function renderAuthPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <AuthPage mode="login" />
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

describe("role-based login navigation", () => {
  const roles = [
    ["MERCHANT", "Merchant", "Northwind Commerce"],
    ["ADMIN", "Admin", "Platform"],
    ["DEVELOPER", "Developer", "Northwind Commerce"],
    ["RISK_ANALYST", "Risk Analyst", "Northwind Commerce"],
  ];

  it.each(roles)(
    "navigates to Overview (/) instead of Ledger for %s",
    async (role, label, merchantName) => {
      vi.spyOn(authApi, "demo").mockResolvedValue(
        authPayload(role, merchantName),
      );

      renderAuthPage();
      const user = userEvent.setup();

      await user.click(
        screen.getByRole("button", { name: new RegExp(`Explore as ${label}`) }),
      );

      expect(authApi.demo).toHaveBeenCalledWith(role);
      // Root cause fix: every demo role must land on Overview, not Ledger.
      expect(mockNavigate).toHaveBeenCalledWith(
        "/",
        expect.objectContaining({ replace: true }),
      );
      expect(mockNavigate).not.toHaveBeenCalledWith("/ledger");
    },
  );
});
