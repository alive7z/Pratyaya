import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { UserProfile } from "../src/components/UserProfile.jsx";
import { AuthProvider } from "../src/app/AuthContext.jsx";
import { authApi } from "../src/lib/apiClient.js";
import { ToastProvider } from "../src/components/ui/Toast.jsx";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const DISPLAY_NAMES = {
  MERCHANT: "Demo Merchant",
  ADMIN: "Demo Administrator",
  DEVELOPER: "Demo Developer",
  RISK_ANALYST: "Demo Risk Analyst",
};

function authPayload(role, merchantName) {
  return {
    user: {
      displayName: DISPLAY_NAMES[role] ?? `Demo ${role}`,
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
  };
}

function renderProfile(role, merchantName) {
  vi.spyOn(authApi, "me").mockResolvedValue({ data: authPayload(role, merchantName) });
  vi.spyOn(authApi, "logout").mockResolvedValue({ loggedOut: true });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/"]}>
          <ToastProvider>
            <UserProfile />
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

describe("UserProfile header component", () => {
  it("displays the authenticated user's name, role, and organization", async () => {
    renderProfile("MERCHANT", "Northwind Commerce");

    await screen.findByText("Demo Merchant");
    await screen.findByText(/Merchant • Northwind Commerce/);
    expect(screen.getByText("DM")).toBeInTheDocument();
  });

  it("displays Administrator / Platform for the admin role", async () => {
    renderProfile("ADMIN", "Platform");

    await screen.findByText("Demo Administrator");
    await screen.findByText(/Administrator • Platform/);
  });

  it("opens the profile dropdown and lists Overview, Switch Demo Role, and Logout", async () => {
    renderProfile("MERCHANT", "Northwind Commerce");
    await screen.findByText("Demo Merchant");

    const trigger = screen.getByLabelText("Account profile");
    await userEvent.click(trigger);

    await screen.findByText("Go to Overview");
    expect(screen.getByText("Switch Demo Role")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("navigates to Overview when Go to Overview is clicked", async () => {
    renderProfile("MERCHANT", "Northwind Commerce");
    await screen.findByText("Demo Merchant");

    const trigger = screen.getByLabelText("Account profile");
    await userEvent.click(trigger);
    await screen.findByText("Go to Overview");

    await userEvent.click(screen.getByText("Go to Overview"));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("logs out and navigates to login", async () => {
    renderProfile("MERCHANT", "Northwind Commerce");
    await screen.findByText("Demo Merchant");

    const trigger = screen.getByLabelText("Account profile");
    await userEvent.click(trigger);
    await screen.findByText("Logout");

    await userEvent.click(screen.getByText("Logout"));
    expect(authApi.logout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
