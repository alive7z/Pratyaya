# Financial invariants

The canonical, implementation-aligned invariant list is [docs/architecture/financial-invariants.md](architecture/financial-invariants.md). Ledger mechanics, chart of accounts, and a worked INR example are documented in [docs/architecture/ledger.md](architecture/ledger.md).

In summary:

1. Money uses positive integer minor units and an explicit ISO currency. JSON uses decimal strings; arithmetic uses `BigInt`, never floating point.
2. Merchants cannot read or mutate another merchant's financial resources.
3. Each journal balances debits and credits in one currency and references same-merchant accounts.
4. Posted journals are immutable; corrections are linked compensating journals.
5. One source event produces at most one journal and duplicate delivery is safe.
6. Payment state, journal, ledger event, and outbox writes commit atomically.
7. Refunds cannot exceed captured amounts and require the original capture journal.
8. Integrity reports describe the examined scope and never mutate financial records.
