import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import AnalyticsPage from "../src/pages/AnalyticsPage.jsx";
import { paymentsApi } from "../src/lib/apiClient.js";

const session = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1" },
    merchantId: "merchant-1",
    permissions: ["payments.read"],
  },
}));
vi.mock("../src/app/AuthContext.jsx", () => ({ useAuth: () => session }));
vi.mock("recharts", async (importOriginal) => ({
  ...(await importOriginal()),
  ResponsiveContainer: ({ children }) => (
    <div style={{ width: 500, height: 300 }}>{children}</div>
  ),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const records = () => [
  {
    id: "pay-1",
    reference: "ORDER-USD",
    currency: "USD",
    status: "CAPTURED",
    amountMinor: "12500",
    capturedMinor: "12500",
    refundedMinor: "0",
    createdAt: new Date().toISOString(),
  },
  {
    id: "pay-2",
    reference: "ORDER-INR",
    currency: "INR",
    status: "FAILED",
    amountMinor: "75000",
    capturedMinor: "0",
    refundedMinor: "0",
    createdAt: new Date().toISOString(),
  },
];
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  session.auth = {
    user: { id: "user-1" },
    merchantId: "merchant-1",
    permissions: ["payments.read"],
  };
});

describe("Analytics page", () => {
  it("shows skeletons while pending, then real metrics and payment links", async () => {
    let resolve;
    vi.spyOn(paymentsApi, "list").mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    renderPage();
    expect(
      screen.getByRole("status", { name: "Loading analytics" }),
    ).toBeInTheDocument();
    // Use the beginning of the day so the payment predates the snapshot boundary.
    const data = records().map((record) => ({
      ...record,
      createdAt: new Date().toISOString().slice(0, 10) + "T00:00:00Z",
    }));
    resolve({ data });
    expect(
      await screen.findByRole("link", { name: "ORDER-USD" }),
    ).toHaveAttribute("href", "/payments/pay-1");
    expect(
      screen.queryByRole("link", { name: "ORDER-INR" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("100.0%")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Daily payment activity: 1 payments, 1 reached capture/,
      }),
    ).toBeInTheDocument();
  });

  it("filters currency locally and fetches a new date window when the period changes", async () => {
    const user = userEvent.setup();
    const data = records().map((record) => ({
      ...record,
      createdAt: new Date().toISOString().slice(0, 10) + "T00:00:00Z",
    }));
    const list = vi.spyOn(paymentsApi, "list").mockResolvedValue({ data });
    renderPage();
    await screen.findByRole("link", { name: "ORDER-USD" });
    await user.selectOptions(screen.getByLabelText("Currency"), "INR");
    expect(
      await screen.findByRole("link", { name: "ORDER-INR" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "ORDER-USD" }),
    ).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
    await user.selectOptions(screen.getByLabelText("Period"), "7");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    const { from, to, limit } = list.mock.calls[1][0];
    expect(limit).toBe(100);
    expect(new Date(to) - new Date(from)).toBeLessThanOrEqual(7 * 86400000);
    await screen.findByRole("link", { name: "ORDER-INR" });
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
  });

  it("offers retry after an error and an actionable empty state", async () => {
    const user = userEvent.setup();
    vi.spyOn(paymentsApi, "list")
      .mockRejectedValueOnce(new Error("Backend unavailable"))
      .mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable",
    );
    expect(screen.queryByText("Gross captured")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("No payments in this view"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore Payments" }),
    ).toHaveAttribute("href", "/payments");
  });

  it("explains the sample limit when 100 payments are returned", async () => {
    vi.spyOn(paymentsApi, "list").mockResolvedValue({
      data: Array.from({ length: 100 }, (_, index) => ({
        ...records()[0],
        id: `pay-${index}`,
        createdAt: new Date().toISOString().slice(0, 10) + "T00:00:00Z",
      })),
    });
    renderPage();
    expect(
      await screen.findByText(/The 100-payment limit has been reached/),
    ).toBeInTheDocument();
  });

  it.each([null, { permissions: [] }])(
    "does not request payment records without access (%j)",
    async (auth) => {
      session.auth = auth;
      const list = vi.spyOn(paymentsApi, "list");
      renderPage();
      expect(
        screen.getByText(
          auth ? "Analytics access required" : "Explore payment analytics",
        ),
      ).toBeInTheDocument();
      expect(list).not.toHaveBeenCalled();
    },
  );
});
