# Ledger architecture

Pratyaya's ledger records confirmed synthetic money movement. It is not a bank ledger and does not process real funds. MongoDB Atlas is authoritative; React totals are display-only projections from posted journals.

## Chart of accounts

The current capture/refund workflow creates only the accounts it needs, once per merchant and currency:

| Code                | Type      | Normal balance | Current use                            |
| ------------------- | --------- | -------------- | -------------------------------------- |
| `PROVIDER_CLEARING` | Asset     | Debit          | Receivable from the simulated provider |
| `MERCHANT_PAYABLE`  | Liability | Credit         | Amount owed to the simulated merchant  |

`CASH_SETTLEMENT`, `PROCESSING_FEE_REVENUE`, and `REFUND_EXPENSE` are reserved concepts. They are not created or posted until settlement, fee, and expense workflows have defined evidence and state machines.

An INR 1,000 confirmed capture posts:

| Account           |     Debit |    Credit |
| ----------------- | --------: | --------: |
| Provider Clearing | ₹1,000.00 |         — |
| Merchant Payable  |         — | ₹1,000.00 |

A confirmed full refund posts a new journal linked to the capture:

| Account           |     Debit |    Credit |
| ----------------- | --------: | --------: |
| Merchant Payable  | ₹1,000.00 |         — |
| Provider Clearing |         — | ₹1,000.00 |

Authorization and payment creation post nothing. Fees, payouts, settlement, FX, and actual cash movement are outside M04.

## Posting workflow

`postJournal()` requires an active MongoDB session and transaction. It validates integer minor units, balance, active account references, merchant ownership, currency, reversal linkage, and source identity. The caller atomically writes the payment transition, embedded immutable journal entries, `LedgerEvent`, and transactional outbox record.

The service deliberately does not open or commit its own transaction. This allows capture/refund services to make the business transition and accounting effect one unit. External HTTP calls never run inside the transaction.

The unique `(merchantId, sourceType, sourceId, eventType)` index and deterministic journal reference make replay safe. An identical replay returns the committed journal; a changed payload for the same source is rejected. MongoDB retries transient transaction errors. If commit returns `UnknownTransactionCommitResult`, the financial wrapper reconciles by the stable source before returning; it does not blindly repost.

## Immutability and balances

Journals embed all entries and are append-only through supported application operations. Update, replacement, and delete model operations reject posted journals. Corrections require a new linked reversal or compensating journal. Direct database-administrator writes are outside application guarantees and are detected by the Integrity Guardian.

Balances are aggregated from `POSTED` journal entries and returned as decimal strings. No mutable balance counter or snapshot authorizes refunds. A liability account's displayed net is credits minus debits; an asset account's net is debits minus credits.

## Capture and refund boundary

`confirmTrustedCapture()` and `confirmTrustedRefund()` are internal domain services exercised with trusted synthetic events. They use optimistic payment versions and conditional updates inside Atlas transactions. Refunds compare the requested amount with the captured amount and already confirmed refunds in the same transaction. Production-facing capture/refund endpoints remain absent until the mock-provider authenticity and operation workflows are complete.
