import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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

function renderApp(initialPath = "/", sessionRequest) {
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

  if (sessionRequest) {
    authApi.me.mockReturnValueOnce(sessionRequest);
  }

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
  it("shows the dashboard and starts health checks while the session is pending", async () => {
    let resolveSession;
    const sessionRequest = new Promise((resolve) => {
      resolveSession = resolve;
    });
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/", sessionRequest);

    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "Payment reliability, engineered from the ledger up.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You can explore the dashboard/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Guest Mode")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Payments", exact: true }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSession({
        data: {
          user: {
            displayName: "Returning User",
            email: "returning@example.com",
          },
          membership: { role: "MERCHANT", status: "ACTIVE" },
          permissions: ["payments.read"],
        },
      });
    });

    expect(
      screen.queryByText(/You can explore the dashboard/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Payments", exact: true }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Guest Mode")).not.toBeInTheDocument();
  });

  it("keeps the dashboard visible when no session can be restored", async () => {
    let rejectSession;
    const sessionRequest = new Promise((_, reject) => {
      rejectSession = reject;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    renderApp("/", sessionRequest);
    const heading = await screen.findByRole("heading", {
      name: "Payment reliability, engineered from the ledger up.",
    });

    await act(async () => {
      rejectSession(new Error("Session unavailable"));
    });

    expect(heading).toBeInTheDocument();
    expect(screen.getByText("Guest Mode")).toBeInTheDocument();
    expect(
      screen.queryByText(/You can explore the dashboard/),
    ).not.toBeInTheDocument();
  });

  it("defers account pages during session checks and lets users open the dashboard", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/payments", new Promise(() => {}));

    expect(
      screen.getByRole("heading", { name: "Connecting to your workspace" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("link", { name: "Explore the dashboard" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Payment reliability, engineered from the ledger up.",
      }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.every(([url]) => String(url).includes("/health/")),
    ).toBe(true);
  });

  it("opens the analytics dashboard instead of the coming soon page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ data: [] })),
    );

    renderApp("/analytics");

    expect(
      await screen.findByRole("heading", { name: "Analytics", exact: true }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No payments in this view"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Analytics is on the way"),
    ).not.toBeInTheDocument();
  });

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
      await screen.findByText(
        "Payment reliability, engineered from the ledger up.",
      ),
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
    await screen.findByText(
      "Payment reliability, engineered from the ledger up.",
    );
    await user.click(screen.getByRole("link", { name: "System Health" }));

    expect(
      await screen.findByRole("heading", { name: "System Health" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Required Infrastructure")).toBeInTheDocument();
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
    await screen.findByRole("heading", { name: "System Health" });

    expect(await screen.findByText("Degraded")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The API is reachable, but a required dependency is unavailable.",
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
    await screen.findByRole("heading", { name: "System Health" });

    expect(await screen.findByText("API unreachable")).toBeInTheDocument();
    expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
  });
});
