# Pratyaya — Intelligent Payment Reliability & Agentic Authorization Platform

Pratyaya is a backend-first synthetic payment reliability platform. It demonstrates correctness, failure recovery, security, auditability, and human-authorized AI assistance without processing real money or payment credentials.

## 1. Technology and boundaries

- React, Vite, Tailwind CSS, React Router, TanStack Query, Recharts, Lucide, and restrained Framer Motion animations.
- Node.js 24 LTS, Express, JavaScript ES modules, Zod, Mongoose, and MongoDB.
- npm workspaces in one repository.
- Modular-monolith API plus independently runnable worker and mock-provider processes.
- MongoDB Atlas replica sets for all environments, including tests; no local Docker MongoDB.
- MongoDB-backed durable outbox/jobs initially. Redis requires later evidence and an ADR.

```text
React SPA
    |
    v
Express API ---- MongoDB Atlas replica set (authoritative Pratyaya data)
                       |
                       | transactional outbox documents
                       v
Worker process -- atomic leases / idempotent processing
    |
    | HTTP using one persisted provider operation ID
    v
Mock provider ---- separate MongoDB Atlas database/cluster
    |
    v
Signed webhook -> API inbox -> MongoDB transaction
```

No transaction crosses Pratyaya and the provider. Provider uncertainty is modeled explicitly. The frontend never owns financial truth.

## 2. Repository structure

```text
apps/
  api/src/
    config/                 environment and runtime configuration
    db/                     Mongoose lifecycle and connectivity checks
    common/                 shared HTTP concerns as the code grows
    middleware/             request IDs, validation, errors, logging, security
    modules/                domain-oriented routes/controllers/services/repositories
  worker/                   MongoDB-backed worker foundation
  mock-provider/            isolated simulated provider HTTP process
  web/                      React/Vite application
packages/shared/            Zod contracts, constants, money helpers
docs/                       architecture, API, invariants, security, ADRs, progress
infra/                      Docker Compose and images
```

Implemented modules must separate routes, controllers, domain services, persistence, validation, and tests. Do not create empty domain directories or pretend later functionality works.

## 3. MongoDB strategy

Mongoose manages application connections with buffering disabled, explicit pool limits, bounded server selection, and clean shutdown. Application startup fails if its required database is unavailable. Readiness also performs a live database ping so a later outage returns `503`.

All application databases must be MongoDB Atlas replica sets because multi-document transactions are the atomic boundary for financial effects. Use separate Atlas clusters/projects for core and provider data where practical. `npm run db:check` verifies connectivity, replica-set topology, and transaction rollback without printing connection strings.

Collections and planned indexes:

| Collection            | Critical indexes/invariants                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `merchants`           | unique merchant ID; lifecycle status                                                           |
| `users`               | unique normalized email; merchant/role index                                                   |
| `payments`            | `{merchantId, createdAt}`; `{merchantId, status}`; version field for conditional transitions   |
| `paymentOperations`   | unique `providerOperationId`; `{paymentId, createdAt}`                                         |
| `idempotencyRecords`  | unique `{merchantId, operationName, key}`; request fingerprint                                 |
| `ledgeraccounts`      | unique `{merchantId, accountCode, currency}`; merchant/currency/status reads                   |
| `journals`            | embedded entries; unique journal reference and `{merchantId, sourceType, sourceId, eventType}` |
| `ledgerevents`        | unique event ID; merchant/time audit queries                                                   |
| `integrityreports`    | `{merchantId, executedAt}` report history                                                      |
| `outboxEvents`        | `{state, availableAt, leaseUntil}` for conditional leasing                                     |
| `inboxEvents`         | unique `{source, providerEventId}` for replay protection                                       |
| `reconciliationCases` | `{status, createdAt}` and unique logical operation where appropriate                           |
| `auditLogs`           | `{merchantId, createdAt}` and resource correlation; append-only                                |

The mock provider uses a separate Atlas database/cluster with its own operation, event, delivery, and fault-rule collections. Production credentials should prevent cross-database access.

## 4. Money and ledger invariants

- Support USD and INR initially; no FX.
- External amounts are positive decimal digit strings such as `"129900"` minor units.
- Application arithmetic uses JavaScript `BigInt`; Mongoose persists it as BSON `BigInt` with explicit range checks. Raw BigInt is never JSON-serialized.
- Authorization creates no settled ledger movement.
- Confirmed capture creates one journal with equal debit and credit totals for one currency.
- Refund creates a new reversing journal; records are never edited or deleted.
- A unique business operation reference prevents duplicate posting.
- The ledger service validates balance and inserts journal, entries, payment totals, audit event, and outbox event in one MongoDB transaction.

M04 implements these rules for trusted synthetic capture/refund fixtures. Journals store embedded entries, payment totals are updated conditionally, and journal/event/outbox writes share the payment transaction.

## 5. Idempotency and concurrency

Payment creation will require `Idempotency-Key`. In one MongoDB transaction, the service will create the idempotency record, payment, audit log, and outbox event. A unique compound index selects one concurrent first writer. Reuse with the same canonical payload returns the established result; reuse with a different payload returns `409`.

State changes use versioned conditional updates such as matching `_id`, `merchantId`, expected state, and version. A failed match is a concurrency conflict or illegal transition, never an instruction to overwrite newer state.

## 6. Provider uncertainty and retries

Before HTTP dispatch, Pratyaya persists one stable provider operation ID. A network timeout or lost response moves the logical operation to `UNKNOWN`; it never implies failure or triggers a new operation at another provider. Reconciliation looks up or safely retries the same provider operation ID. Duplicate jobs and webhooks may occur, so inbox records and unique business references make effects idempotent.

Public payment execution, provider calls, adaptive routing, retries, and live reconciliation are not active in M04. Capture/refund journal posting is reachable only through trusted synthetic fixtures and tests.

## 7. Security

- Deployed traffic uses TLS, restricted CORS, Helmet, request limits, rate limiting, and redacted structured logs.
- Authentication uses short-lived JWT access tokens plus rotated hashed refresh tokens in HttpOnly cookies, with CSRF double-submit protection for cookie-authenticated mutations.
- Every resource query includes server-derived merchant scope; frontend guards are not security boundaries.
- Webhooks require HMAC-SHA256 over raw bytes, timestamp tolerance, timing-safe comparison, and inbox deduplication.
- Connection strings, tokens, passwords, and provider secrets remain environment-only and never appear in `/system/info`.
- Demo sessions are credential-free, revocable, short-lived, rate-limited, and restricted to synthetic sandbox data.
- No PAN, CVV, real bank credentials, or PCI-compliance claims.

## 8. API conventions

All routes are versioned under `/api/v1`, except documentation. Success and error responses include a request ID and timestamp. Validation errors are structured; internal database/provider details are not exposed.

Implemented endpoints in the current milestone:

```text
GET  /api/v1/health/live
GET  /api/v1/health/ready
GET  /api/v1/system/info
GET  /api/v1/demo/roles
POST /api/v1/demo/session
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
GET  /api/v1/dashboard/merchant
GET  /api/v1/dashboard/admin
GET  /api/v1/dashboard/developer
GET  /api/v1/dashboard/risk
GET  /api/v1/audit-logs
GET  /api/v1/ledger/accounts
GET  /api/v1/ledger/accounts/:accountId
GET  /api/v1/ledger/accounts/:accountId/entries
GET  /api/v1/ledger/journals
GET  /api/v1/ledger/journals/:journalId
GET  /api/v1/ledger/balances
GET  /api/v1/ledger/trial-balance
POST /api/v1/ledger/integrity/check
GET  /api/v1/ledger/integrity/reports
GET  /api/v1/ledger/integrity/reports/:reportId
GET  /api/v1/reconciliation
GET  /api/v1/reconciliation/:recordId
GET  /api-docs
GET  /api-docs/openapi.json
```

## 9. Milestones

- **M01 Foundation:** workspaces, Mongoose lifecycle, health/system endpoints, worker/provider foundations, React shell, tests, OpenAPI, CI, and architecture documentation.
- **M02 Auth/RBAC and Atlas:** MongoDB Atlas migration, merchant/auth/RBAC, demo sessions, dashboards, audit logging.
- **M03 Payment API foundation:** idempotent create/cancel, payment events, versioned transitions, outbox foundation, merchant isolation.
- **M04 Ledger engine:** immutable balanced journals, trusted capture/refund fixtures, integrity guardian, ledger APIs, Ledger Explorer, synthetic reconciliation diagnostics.
- **M05 Provider workflow and recovery:** mock-provider operations, outbox leasing/dispatch, authorize/capture/refund, signed webhooks, UNKNOWN resolution, live reconciliation.
- **M06 Product UI:** payment, ledger, reconciliation, reliability, and audit workflows beyond the current dashboards.
- **M07 AgentPay:** deterministic parser, optional LLM proposal drafting, policies, explicit approval, adversarial tests.
- **M08 Observability/deployment:** traces, metrics, deployment hardening, smoke tests, and honest benchmarks.

Each milestone ends with real commands, tests, and an accurate progress record. Do not begin a dependent milestone while its prerequisites are failing.

## 10. Current acceptance (M04)

- Clean dependency installation, formatting, linting, tests, and frontend build pass.
- `npm run db:check` confirms Atlas replica-set topology and transaction rollback.
- The integration suite covers transaction commit/rollback, balanced journals, merchant isolation, duplicate safety, 100 concurrent capture confirmations, refund limits, and corrupt-fixture detection. See `docs/PROGRESS.md` for which revision last executed successfully and the current Atlas access-list blocker.
- Auth, demo sessions, RBAC, ledger reads, integrity execution, and audit access are covered by tests.
- Public capture/refund execution, provider financial operations, outbox dispatch, signed webhooks, live reconciliation, chaos execution, and AgentPay remain unimplemented.
