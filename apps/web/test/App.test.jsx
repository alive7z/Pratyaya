import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import App from "../src/app/App.jsx";
import { AuthProvider } from "../src/app/AuthContext.jsx";
import { authApi } from "../src/lib/apiClient.js";

const livenessPayload = {
  data: {
    status: "ok",
    service: "pratyaya-api",
    version: "0.1.0",
    uptimeSeconds: 125,
    timestamp: new Date().toISOString(),
  },
  meta: { requestId: "test-live", timestamp: new Date().toISOString() },
};

const readinessPayload = {
  data: {
    status: "ready",
    service: "pratyaya-api",
    version: "0.1.0",
    checks: {
      database: { status: "up", latencyMs: 3 },
    },
    timestamp: new Date().toISOString(),
  },
  meta: { requestId: "test-ready", timestamp: new Date().toISOString() },
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderApp(initialPath = "/") {
  vi.spyOn(authApi, "me").mockResolvedValue({
    data: {
      user: { displayName: "Test User", email: "test@example.com" },
      membership: { role: "MERCHANT", status: "ACTIVE" },
      merchant: { name: "Test Merchant" },
      permissions: [
        "payments.read",
        "ledger.read",
        "system.health.read",
        "agentpay.read",
        "risk.dashboard.read",
        "risk.alerts.read",
      ],
      isDemo: false,
    },
    meta: { requestId: "test-auth" },
  });

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Pratyaya web foundation", () => {
  it("renders the simulation disclaimer and live backend status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        return String(input).includes("/health/ready")
          ? jsonResponse(readinessPayload)
          : jsonResponse(livenessPayload);
      }),
    );

    renderApp("/");

    expect(
      await screen.findByText(
        /Simulation only — never enter real card, bank, or personal payment data/i,
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(
      await screen.findByText("M10 Full-Stack UI Integration"),
    ).toBeInTheDocument();
  });

  it("navigates to the system health page and shows real dependency rows", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        return String(input).includes("/health/ready")
          ? jsonResponse(readinessPayload)
          : jsonResponse(livenessPayload);
      }),
    );

    renderApp("/");
    await screen.findByText("M10 Full-Stack UI Integration");
    await user.click(screen.getByRole("link", { name: "System Health" }));

    expect(
      await screen.findByRole("heading", { name: "System health" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Required infrastructure")).toBeInTheDocument();
    expect(screen.getByText("MongoDB")).toBeInTheDocument();
    expect(screen.getByText("pratyaya-api")).toBeInTheDocument();
  });

  it("shows a degraded state without treating readiness 503 as a network failure", async () => {
    const degraded = {
      ...readinessPayload,
      data: {
        ...readinessPayload.data,
        status: "not_ready",
        checks: {
          database: {
            status: "down",
            latencyMs: 2001,
            code: "DATABASE_UNAVAILABLE",
          },
        },
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        return String(input).includes("/health/ready")
          ? jsonResponse(degraded, 503)
          : jsonResponse(livenessPayload);
      }),
    );

    renderApp("/health");
    await screen.findByText("M10 Full-Stack UI Integration");

    expect(await screen.findByText("Degraded")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The API process is reachable, but a required dependency is unavailable.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Down").length).toBeGreaterThanOrEqual(1);
  });

  it("reports an unreachable API without inventing health values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    renderApp("/health");
    await screen.findByText("M10 Full-Stack UI Integration");

    expect(await screen.findByText("API unreachable")).toBeInTheDocument();
    expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
  });
});
