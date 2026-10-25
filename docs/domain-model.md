# Domain model and MongoDB collections

This page summarizes the implemented persistence model. The API and worker share the core Atlas database. The independently running mock provider stores its own operation records in the provider database. Collection names below are the Mongoose model names converted to MongoDB's default pluralized names.

## Core payment and accounting records

| Collection                          | Purpose                                                                | Key relationship or invariant                                                        |
| ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `merchants`, `memberships`, `users` | Tenant identity and role membership                                    | Request merchant scope is derived from the authenticated membership                  |
| `sessions`                          | Revocable access/refresh session state                                 | Refresh tokens are hashed; session/demo expiry is persisted                          |
| `payments`                          | Payment amount, currency, state, captured/refunded totals, and version | Unique merchant/reference; financial amounts are integer minor units                 |
| `paymentevents`                     | Append-only payment state and actor timeline                           | Each event is merchant-scoped and references a payment                               |
| `refunds`                           | Requested, reserved, processed, and confirmed refunds                  | Merchant idempotency key; reservation counts against available captured amount       |
| `idempotencyrecords`                | API idempotency state, request fingerprint, and result                 | Unique merchant/operation/key hash; rejects key reuse with different request content |
| `provideroperations` (core DB)      | Pratyaya's durable authorization/capture/refund operation state        | Stable operation identity and state used for retry/reconciliation                    |
| `outboxevents`                      | Transactional work/event records                                       | Created with the business mutation; leased and dispatched asynchronously             |
| `jobs`                              | Worker retries, leases, attempts, and dead-letter status               | Deterministic IDs and unique source event prevent duplicate job creation             |
| `ledgeraccounts`                    | Per-merchant, per-currency chart of accounts                           | Unique merchant/account-code/currency tuple                                          |
| `journals`                          | Immutable posted journal and embedded entries                          | Unique source event; balanced debit/credit amounts in one currency                   |
| `ledgerevents`                      | Journal audit/event projection                                         | References the corresponding journal and merchant                                    |
| `integrityreports`                  | Results of ledger integrity checks                                     | Diagnostic output; does not modify journal history                                   |

## Provider, risk, reconciliation, and agent records

| Collection                                                                                                           | Purpose                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `provideroperations` (provider DB)                                                                                   | Provider-side idempotent operation result and provider reference; isolated from core DB credentials |
| `inboxevents`                                                                                                        | Authenticated, deduplicated provider webhooks and processing status                                 |
| `reconciliationrecords`, `reconciliationcases`                                                                       | Stored comparisons and review cases for payment/provider-operation state                            |
| `riskrules`, `riskdecisions`, `riskalerts`                                                                           | Configured synthetic risk policy, per-payment decision, and review alert                            |
| `paymentproviders`, `providerroutingpolicies`, `routingdecisions`, `providerhealthsnapshots`, `circuitbreakerstates` | Synthetic provider configuration and routing/reliability evidence                                   |
| `agentpolicies`, `agentproposals`, `agentapprovals`, `agentauditevents`                                              | Invoice proposal, policy evaluation, human decision, execution, and audit trail                     |
| `auditlogs`                                                                                                          | Security and privileged action history                                                              |

The provider collection named `provideroperations` belongs to a separate MongoDB database and has a distinct Mongoose schema. Similar collection names do not imply shared data or credentials.

## Data handling rules

- Amounts are persisted as BSON integer/BigInt values and returned in API JSON as decimal strings. Currency is explicit (`USD` or `INR`, both currently two decimal places).
- The UI displays major units; it converts to minor units at the API boundary once. The backend never uses floating-point financial arithmetic.
- Schemas are strict. API controllers return explicit DTOs instead of exposing raw Mongoose documents.
- All tenant-facing reads and writes include the authenticated merchant scope. Never take `merchantId` authority from an untrusted request body.
- Journals embed their entries and are immutable through supported application operations. Balances are derived from posted journals, not mutable counters.

## Source references

- [Payment model](../apps/api/src/modules/payments/payment.model.js)
- [Refund model](../apps/api/src/modules/payments/refund.model.js)
- [Core provider-operation model](../apps/api/src/modules/payments/operations/provider-operation.model.js)
- [Provider-side operation model](../apps/mock-provider/src/modules/operations/provider-operation.model.js)
- [Journal model](../apps/api/src/modules/ledger/journal.model.js)
- [Financial invariants](financial-invariants.md)
