import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RefundManagement } from "../src/features/payments/RefundManagement.jsx";
import { apiClient } from "../src/lib/apiClient.js";

vi.mock("../src/app/AuthContext.jsx", () => ({
  useAuth: () => ({
    auth: {
      merchantId: "merchant-test",
      permissions: ["payments.read", "payments.create", "refunds.create"],
    },
  }),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/payments/payment-1/refunds"]}>
        <Routes>
          <Route
            path="/payments/:paymentId/refunds"
            element={<RefundManagement />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Refund Management", () => {
  it("loads backend balances and sends a full refund with an idempotency key", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url) => {
      if (url.endsWith("/refunds")) {
        return Promise.resolve({ data: { refunds: [] } });
      }
      return Promise.resolve({
        data: {
          payment: {
            id: "payment-1",
            reference: "PAY-1",
            currency: "USD",
            capturedMinor: "10000",
            refundedMinor: "2500",
            status: "PARTIALLY_REFUNDED",
          },
        },
      });
    });
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { refund: { id: "refund-1", status: "REQUESTED" } },
    });

    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Refund Management");
    expect(screen.getByText("$75.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create Refund" }));
    await user.click(screen.getByLabelText("Refund full available amount"));
    await user.type(
      screen.getByLabelText("Reason (optional)"),
      "Customer request",
    );
    await user.click(screen.getByRole("button", { name: "Create Refund" }));

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, options] = post.mock.calls[0];
    expect(url).toBe("/api/v1/payments/payment-1/refunds");
    expect(body).toEqual({
      amountMinor: "7500",
      currency: "USD",
      reason: "Customer request",
    });
    expect(options.headers["Idempotency-Key"]).toMatch(/^refund_/);
  });

  it("converts a partial major-unit amount exactly once", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url) =>
      Promise.resolve(
        url.endsWith("/refunds")
          ? { data: { refunds: [] } }
          : {
              data: {
                payment: {
                  id: "payment-1",
                  reference: "PAY-1",
                  currency: "USD",
                  capturedMinor: "50000",
                  refundedMinor: "0",
                  status: "CAPTURED",
                },
              },
            },
      ),
    );
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Create Refund" }),
    );
    await user.type(screen.getByLabelText("Refund amount"), "125.50");
    await user.click(screen.getByRole("button", { name: "Create Refund" }));

    expect(post.mock.calls[0][1].amountMinor).toBe("12550");
  });
});
