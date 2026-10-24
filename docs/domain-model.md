# MongoDB data model

This table reflects the current implementation. Auth, demo, dashboard, payments foundation, ledger, integrity, and synthetic reconciliation models are present. Provider operations, webhooks, live reconciliation writes, and AgentPay remain planned.

| Collection              | Principal fields                                                              | Planned indexes                                              |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `merchants`             | `_id`, display name, status, secret reference                                 | status                                                       |
| `users`                 | normalized email, password hash, role, merchant ID, status                    | unique email; merchant/role                                  |
| `refreshTokens`         | user ID, token hash, expiry, revocation/replacement                           | unique token hash; user/expiry                               |
| `payments`              | merchant ID, amount/captured/refunded BSON BigInts, currency, status, version | merchant/created; merchant/status; unique merchant/reference |
| `paymentEvents`         | payment ID, from/to status, actor, summary, metadata                          | payment/occurred                                             |
| `idempotencyRecords`    | merchant ID, operation name, key, request hash, response                      | unique merchant/operation/key; expiry                        |
| `ledgerAccounts`        | merchant ID, currency, code, type, normal balance, status                     | unique merchant/code/currency                                |
| `journals`              | merchant/payment ID, source event, event type, currency, immutable entries    | unique merchant/source/type; merchant/date                   |
| `ledgerEvents`          | journal ID/reference, event type, actor, request ID                           | unique event ID; merchant/occurred                           |
| `integrityReports`      | merchant ID, currency, status, summary, checks, executor                      | merchant/executed                                            |
| `outboxEvents`          | aggregate, event type, payload, state, availability, lease                    | state/availability/lease; merchant/aggregate                 |
| `reconciliationRecords` | merchant/payment IDs, provider reference, statuses, observed/expected amounts | unique merchant/provider reference; status                   |
| `reconciliationCases`   | operation/payment IDs, reason, status, observed/expected amounts              | status/created; operation                                    |
| `auditLogs`             | actor/merchant IDs, action, resource, snapshots, correlation                  | merchant/created; resource                                   |

Merchant IDs are server-derived, never trusted from request bodies. Models use strict schemas and repositories return explicit DTOs rather than raw MongoDB documents. Ledger entries are embedded in immutable journals; balances are derived by aggregation. See `docs/architecture/ledger.md`.
