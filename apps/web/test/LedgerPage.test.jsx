import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import LedgerPage from "../src/pages/LedgerPage.jsx";
import { AuthProvider } from "../src/app/AuthContext.jsx";
import { authApi } from "../src/lib/apiClient.js";

function response(data) {
  return new Response(
    JSON.stringify({ data, meta: { requestId: "ledger-test" } }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

const account = {
  id: "64b00000000000000000901",
  accountName: "Provider Clearing",
  accountCode: "PROVIDER_CLEARING",
  accountType: "ASSET",
  currency: "INR",
  debitMinor: "100000",
  creditMinor: "25000",
  netMinor: "75000",
  status: "ACTIVE",
};
const journal = {
  id: "64b00000000000000000902",
  journalReference: "JRN-TEST-CAPTURE",
  eventType: "CAPTURE",
  sourceId: "payment-test",
  currency: "INR",
  postedAt: new Date().toISOString(),
  entries: [
    { accountId: account.id, direction: "DEBIT", amountMinor: "100000" },
    {
      accountId: "64b00000000000000000903",
      direction: "CREDIT",
      amountMinor: "100000",
    },
  ],
};

function renderPage(role = "ADMIN") {
  vi.spyOn(authApi, "me").mockResolvedValue({
    data: {
      user: { id: "user-ledger-test", displayName: "Ledger Tester" },
      membership: {
        role,
        status: "ACTIVE",
        merchant: { id: "merchant-ledger-test", name: "Ledger Test" },
      },
      permissions: ["ledger.read", "ledger.integrity.run"],
      session: { isDemo: true },
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter>
          <LedgerPage />
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

describe("Ledger Explorer", () => {
  it("renders real account data, journal breakdown, integrity findings, and reconciliation fixtures", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/auth/me"))
          return response({ membership: { role: "ADMIN" } });
        if (url.includes(`/ledger/accounts/${account.id}/entries`)) {
          return response({
            items: [
              {
                journalId: journal.id,
                journalReference: journal.journalReference,
                eventType: journal.eventType,
                sourceId: journal.sourceId,
                direction: "DEBIT",
                amountMinor: "100000",
              },
            ],
            total: 1,
          });
        }
        if (url.includes(`/ledger/accounts/${account.id}`))
          return response(account);
        if (url.includes("/ledger/accounts"))
          return response({ items: [account], total: 1 });
        if (url.includes("/ledger/journals"))
          return response({ items: [journal], total: 1 });
        if (url.includes("/ledger/integrity/reports")) {
          return response({
            items: [
              {
                id: "report-1",
                status: "FAIL",
                summary: { passed: 8, failed: 1, inconclusive: 1 },
                checks: [
                  {
                    checkId: "balanced-journals",
                    checkName: "Balanced journals",
                    status: "FAIL",
                    affectedRecords: 1,
                    severity: "CRITICAL",
                    remediation: "Investigate and compensate.",
                  },
                ],
              },
            ],
          });
        }
        if (url.includes("/reconciliation")) {
          return response({
            items: [
              {
                id: "recon-1",
                providerReference: "provider-fixture-1",
                internalPaymentStatus: "CAPTURED",
                externalProviderStatus: "CAPTURED",
                expectedAmountMinor: "100000",
                observedAmountMinor: "100000",
                currency: "INR",
                status: "MATCHED",
              },
            ],
            summary: { MATCHED: 1, PENDING_REVIEW: 0 },
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    renderPage();
    expect(
      (await screen.findAllByText("₹1,000.00")).length,
    ).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole("tab", { name: "Accounts" }));
    expect(screen.getByText("Provider Clearing")).toBeInTheDocument();
    expect(screen.getByText("₹750.00")).toBeInTheDocument();
    await user.click(screen.getByText("Provider Clearing"));
    expect(await screen.findByText("Account detail")).toBeInTheDocument();
    expect(screen.getByText("JRN-TEST-CAPTURE")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Journals" }));
    await user.click(screen.getByText("JRN-TEST-CAPTURE"));
    expect(screen.getByText("Debit / credit breakdown")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Integrity" }));
    expect(await screen.findByText("Balanced journals")).toBeInTheDocument();
    expect(screen.getByText("CRITICAL", { exact: false })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Reconciliation" }));
    expect(await screen.findByText("provider-fixture-1")).toBeInTheDocument();
    expect(
      screen.getByText(/synthetic fixtures until simulator integration/i),
    ).toBeInTheDocument();
    expect(screen.getByText("MATCHED: 1")).toBeInTheDocument();
  });

  it("shows a loading state while ledger queries are pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderPage("MERCHANT");
    expect(await screen.findByLabelText("Loading ledger")).toBeInTheDocument();
  });

  it("shows an actionable error when ledger access is denied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/auth/me"))
          return response({ membership: { role: "MERCHANT" } });
        return new Response(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: "You do not have permission to view this ledger.",
            },
            meta: { requestId: "ledger-error" },
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ledger data is unavailable",
    );
  });
});
