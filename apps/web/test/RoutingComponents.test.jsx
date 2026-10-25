import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { RoutingAnalytics } from "../src/features/payments/RoutingAnalytics.jsx";
import { RoutingDecisionExplorer } from "../src/features/payments/RoutingDecisionExplorer.jsx";
import { apiClient } from "../src/lib/apiClient.js";

// Mock AuthContext
vi.mock("../src/app/AuthContext.jsx", () => ({
  useAuth: () => ({
    auth: {
      merchantId: "merch_123",
      user: { displayName: "Tester", email: "tester@example.com" },
      merchant: { name: "Test Merchant" },
      membership: { role: "MERCHANT", status: "ACTIVE" },
      permissions: ["payments.read"],
    },
  }),
}));

// Mock ResponsiveContainer for recharts
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Routing components resilience", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders RoutingAnalytics without crashing on Recharts or undefined symbols", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url) => {
      if (url.includes("/api/v1/routing/decisions")) {
        return Promise.resolve({
          data: {
            items: [
              {
                decisionId: "dec_1234567890abcdef",
                selectedProviderId: "alpha",
                routingStrategy: "RELIABILITY_FIRST",
                decisionReason: "PROVIDER_SELECTED",
              },
            ],
          },
        });
      }
      if (url.includes("/api/v1/routing/providers")) {
        return Promise.resolve({
          data: [
            {
              providerId: "alpha",
              healthMetrics: { latencyP50Ms: 120, latencyP95Ms: 250 },
            },
          ],
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithClient(<RoutingAnalytics />);

    expect(await screen.findByText("Routing Analytics")).toBeInTheDocument();
    expect(
      await screen.findByText("Routing Distribution by Provider"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Routing Strategy Usage"),
    ).toBeInTheDocument();
  });

  it("renders RoutingDecisionExplorer and handles modal open/close without crashing", async () => {
    const mockDecisions = [
      {
        decisionId: "dec_abcdef1234567890",
        paymentId: "pay_987654321012",
        selectedProviderId: "alpha",
        routingStrategy: "RELIABILITY_FIRST",
        decisionReason: "PROVIDER_SELECTED",
        operationType: "AUTHORIZE",
        amountMinor: 5000,
        currency: "USD",
        createdAt: new Date().toISOString(),
        scoreBreakdown: [
          {
            providerId: "alpha",
            reliabilityScore: 0.99,
            latencyScore: 0.95,
            costScore: 0.9,
            weightedScore: 0.96,
          },
        ],
        eligibleProviders: ["alpha", "beta"],
        rejectedProviders: [],
      },
    ];

    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        items: mockDecisions,
      },
    });

    const user = userEvent.setup();
    renderWithClient(<RoutingDecisionExplorer />);

    expect(
      await screen.findByText("Routing Decision Explorer"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Routing Decisions (1)"),
    ).toBeInTheDocument();

    // Clicking the view button opens the details modal without throwing ReferenceError: X is not defined
    const viewButton = screen.getByRole("button", {
      name: "View decision details",
    });
    await user.click(viewButton);

    expect(screen.getByText("Routing Decision Details")).toBeInTheDocument();
    expect(screen.getByText("Scoring Breakdown")).toBeInTheDocument();

    // Clicking close button closes the modal
    const closeBtn = screen.getByRole("button", { name: /close/i });
    await user.click(closeBtn);

    expect(
      screen.queryByText("Routing Decision Details"),
    ).not.toBeInTheDocument();
  });
});
