import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReliabilityLab } from "../src/features/payments/ReliabilityLab.jsx";
import { apiClient } from "../src/lib/apiClient.js";

const { authFixture } = vi.hoisted(() => ({
  authFixture: {
    user: { isDemo: true },
    session: { isDemo: true },
    membership: { merchant: { isDemo: true } },
    permissions: ["payments.create", "payments.read"],
  },
}));

vi.mock("../src/app/AuthContext.jsx", () => ({
  useAuth: () => ({ auth: authFixture }),
}));

function renderLab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReliabilityLab />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Reliability Lab access", () => {
  it("enables fault scenarios for the server's demo session shape", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { faults: { enabled: false, rules: [] } },
    });

    renderLab();

    expect(
      await screen.findByRole("button", { name: "Run Test" }),
    ).toBeEnabled();
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/sandbox/faults");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
