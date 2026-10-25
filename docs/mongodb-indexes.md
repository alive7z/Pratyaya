# MongoDB indexes and migrations

Mongoose schemas declare query and uniqueness indexes. Index definitions are part of the correctness boundary: they arbitrate uniqueness under concurrency, support merchant-scoped reads, and help workers recover durable work. The inventory below highlights critical indexes and is not a substitute for reviewing each schema before a production migration.

## Critical indexes

| Data                     | Index purpose                                                                                                                       | Why it matters                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Payments                 | Unique merchant/reference and merchant/idempotency identity; merchant-scoped recent/status queries                                  | Prevent duplicate requests and keep payment reads scoped            |
| Refunds                  | Unique `(merchantId, idempotencyKey)`; payment history queries                                                                      | Make refund retries safe and histories bounded by payment           |
| Journals                 | Unique journal reference and unique `(merchantId, sourceType, sourceId, eventType)`; merchant/currency/time and account-entry reads | Enforce one accounting effect per source and support ledger queries |
| Ledger accounts          | Unique `(merchantId, accountCode, currency)`                                                                                        | Prevent duplicate chart-of-account entries                          |
| Core provider operations | Stable operation/client identities and merchant/type/idempotency identity                                                           | Resolve uncertain responses without generating a new operation      |
| Mock-provider operations | Unique operation ID and provider-scoped idempotency identity                                                                        | Keep provider simulation independently replay-safe                  |
| Outbox and worker jobs   | State/availability/lease selection and stable source-event/job identities                                                           | Recover expired work and avoid duplicate dispatch                   |
| Webhook inbox            | Unique `(source, providerEventId)` with processing/received-time queries                                                            | Reject duplicate inbound events and find pending work               |
| Reconciliation           | Merchant/status/time queries and partial unique provider-reference identity                                                         | Support review queues and replay-safe observations                  |

For exact keys and options, inspect the Mongoose schemas under `apps/api/src/modules`, `apps/worker/src/modules`, and `apps/mock-provider/src/modules`. Do not copy a partial summary into a hand-written index migration without comparing the actual schema and existing Atlas indexes.

## Provisioning and migration

`MONGODB_AUTO_INDEX` controls automatic index creation. Development can use automatic creation; production-style environments should provision reviewed indexes deliberately and set auto-index behavior according to the deployment configuration. Before changing a unique index, check existing data for collisions and verify the exact key/options. The provider migration removes only the known obsolete `providerOperationId_1` index after checking its key, then creates the current provider indexes.

Use separate synthetic core/provider databases and least-privilege credentials. `npm run db:check` verifies configured database connectivity and transaction support; `npm run db:migrate:provider` applies the targeted provider-index migration. Never run migrations against real-money or customer data.

## Financial source of truth

Ledger balances are aggregated from posted immutable journals; index state does not replace transaction validation. Unique indexes, conditional updates, and MongoDB transactions work together to prevent duplicate or partial financial effects. See [ledger invariants](architecture/financial-invariants.md) and [ledger workflow](architecture/ledger.md).
