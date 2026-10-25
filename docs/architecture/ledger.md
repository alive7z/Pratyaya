# Ledger and financial integrity

Pratyaya records confirmed **synthetic** payment movement in MongoDB. It is a portfolio simulation, not a bank ledger or real-money processor. Posted journals are the accounting source of truth; UI totals are projections.

## Accounts and postings

The current capture/refund workflow provisions two merchant- and currency-scoped accounts:

| Account             | Type      | Normal balance | Use                                   |
| ------------------- | --------- | -------------- | ------------------------------------- |
| `PROVIDER_CLEARING` | Asset     | Debit          | Simulated provider receivable         |
| `MERCHANT_PAYABLE`  | Liability | Credit         | Amount owed to the simulated merchant |

A confirmed capture debits Provider Clearing and credits Merchant Payable. A confirmed refund creates a new journal that debits Merchant Payable and credits Provider Clearing, linked to the capture journal. Authorization, payment creation, and pending refund reservation do not post accounting entries. Settlement, fees, FX, and cash payouts are not implemented accounting flows.

## Atomic posting

Capture and trusted refund confirmation run their payment update, journal post, ledger event, and outbox write under a MongoDB transaction/session. Refund record confirmation participates in the same transaction. External provider HTTP calls are outside the posting service; provider orchestration must apply the returned outcome through the trusted domain workflow.

`postJournal()` requires the caller's active session. It validates integer minor units, balanced entries, account ownership/status/currency, source identity, and reversal linkage. The unique source tuple and deterministic reference make replays safe: identical committed sources resolve to the existing effect; conflicting payloads fail. Transaction retry/unknown-commit handling reconciles by the stable source instead of blindly posting again.

## Immutability and integrity checks

Journals embed entries and are append-only through supported model operations. Corrections require a compensating journal; posted entries are not edited in place. Application safeguards do not constrain a database administrator with direct write access. The Integrity Guardian checks stored accounting invariants and reports findings; it is diagnostic and does not repair or rewrite journals.

Balances are aggregated from posted journal entries and returned as decimal strings. There is no mutable balance counter that can authorize a refund. Refund capacity is checked against captured amount, confirmed refunds, and pending reservations inside the transaction.

## Public API boundary

Authenticated merchant payment APIs expose capture and refund operations, but ledger posting remains an internal domain operation triggered by trusted simulated provider outcomes. All endpoints are sandbox/demo-only and require the existing authorization, merchant scope, and idempotency controls. See [API conventions](../api-conventions.md), [financial invariants](financial-invariants.md), and [MongoDB indexes](../mongodb-indexes.md).
