# Implementation progress

## Milestone 01 — MongoDB foundation

Status: implementation complete. Core transaction behavior was Atlas-verified on 2026-10-23; the expanded final suite needs one rerun after the Atlas client-network access list is restored.

### Implemented

- MongoDB/Mongoose architecture selected and governing documentation updated
- MySQL migrations, SQL seed, Redis/BullMQ foundation, and stale architecture kit removed
- core MongoDB replica-set Compose service and separate provider MongoDB service
- Mongoose connection lifecycle and `db:check` topology verification
- API liveness, database readiness, and non-secret system information
- MongoDB-connected worker/provider process foundations and health endpoints
- expanded responsive React shell, light/dark themes, planned-feature pages, real connectivity state, and labeled illustrative chart
- root-level Compose workflow, OpenAPI, CI, environment template, and accurate local-development instructions

### Verification evidence

- `npm ci` — passed; 529 packages installed, audit reported 0 vulnerabilities
- `docker compose --env-file .env.example config --quiet` — passed
- `npm run db:check` — passed; connected to MongoDB and verified replica set `rs0`
- `npm run verify` — passed from the clean install:
  - Prettier check passed
  - ESLint passed
  - API unit/API tests: 10 passed; 3 infrastructure-gated tests skipped by the unit command
  - mock-provider tests: 4 passed
  - React tests: 4 passed
  - shared money/schema tests: 7 passed
  - Vite production build passed; the illustrative Recharts module is lazy-loaded into its own chunk
- `npm run test:integration` — passed; 13 API tests, including real replica-set transaction commit and rollback
- `API_PORT=14000 docker compose --env-file .env up --build -d` — passed; all images built and all required containers reached healthy/running state
- direct HTTP checks passed for API readiness, provider readiness, worker readiness, the Nginx API proxy, and the dashboard (`200`)
- SIGTERM stop test passed for API, worker, and mock provider; logs confirmed connection closure and clean process exit
- `.env` is ignored by `.gitignore`; system information and logs were checked for connection-string leakage

The first Compose startup could not bind host port `4000` because an unrelated local container already owned it. Verification used the documented `API_PORT=14000` override; container-internal ports and proxy behavior were unchanged. An initial configuration test also caught `MONGODB_AUTO_INDEX` defaulting to a string; the parser was corrected to return a validated boolean before the passing runs above.

Automated visual browser inspection was unavailable in this coding session. React DOM tests, production build, dashboard HTTP delivery, and frontend-to-backend proxy checks passed; a human responsive-layout review remains advisable.

### Pending after M01

Authentication, merchant isolation enforcement, payments, idempotency execution, state transitions, provider operations, durable job leasing, ledger posting, webhooks, reconciliation, chaos execution, risk, analytics backed by real records, and AgentPay remain unimplemented.

## Milestone 02 — Atlas migration and auth/demo foundation

Status: in progress. Do not treat any item below as verified until the corresponding command is recorded here.

### Implemented in this workspace

- MongoDB Atlas is now the required authoritative store for API, worker, and mock provider
- `MONGODB_URI` and `PROVIDER_MONGODB_URI` configuration validation requires Atlas-style `mongodb+srv://` URIs
- `npm run db:check` verifies connectivity, replica-set topology, and transaction rollback for core, provider, and worker databases without logging connection strings
- Docker MongoDB services, local Mongo volumes, and Mongo-dependent Compose startup checks removed
- CI no longer starts local MongoDB; Atlas-backed checks run only when repository secrets are configured
- `.env.example`, README, architecture, threat model, API conventions, and Compose updated for Atlas and managed services
- registration/login/logout/refresh/me endpoints with scrypt password hashing, HS256 JWT access tokens, hashed rotating refresh tokens stored in MongoDB, HttpOnly cookies, and CSRF double-submit protection
- merchant memberships and server-side RBAC middleware
- credential-free demo roles and sessions for Merchant, Admin, Developer, and Risk Analyst
- deterministic demo seed with script `npm run seed:demo`
- role dashboard APIs and scoped audit-log API
- shared auth/demo validation schemas and role/permission constants

### Known gaps and risks

- Core Atlas credentials are now available, and the API database check verified replica-set topology and transaction rollback. The separate mock-provider Atlas URI is still not configured, so the full multi-process database check does not pass and the worker check is not reached.
- Auth and demo service flows still need integration coverage against Atlas (registration/login/refresh/logout, demo quotas, seed idempotency, session expiry/revocation, and merchant isolation).
- Frontend auth/dashboard work is intentionally paused; the Atlas request supersedes the M02 UI scope.
- Previous M01 Docker-based verification remains historical evidence for that milestone; it does not verify the current Atlas configuration.

### Verification evidence (2026-10-23)

- `npm run format` — passed; applied formatting to changed auth, demo, docs, and configuration files.
- `npm run format:check` — passed; all tracked files use Prettier style.
- `npm run lint` — passed with no ESLint errors.
- `npm test` — passed:
  - API: 18 passed, 3 Atlas integration tests skipped by the unit command
  - mock provider: 4 passed
  - web: 4 passed
  - shared: 7 passed
- `npm run build` — passed; Vite production build completed.
- `npm run db:check --workspace @pratyaya/api` — failed fast as designed because no Atlas SRV URI was configured; the error identifies `MONGODB_URI` as invalid and does not print a connection string. Atlas connectivity and transaction verification remain unverified.
- New unit coverage added for password hashing/verification, signed-token issue/verify/rejection, and CSRF double-submit behavior.

### Verification update (2026-10-23)

- `npm run verify` — passed: formatting, linting, 18 API tests, 4 mock-provider tests, 4 React tests, 7 shared tests, and the Vite production build.
- `npm run db:check` — partially passed: the core API Atlas check verified writable replica-set topology and transaction rollback; the command then failed because `PROVIDER_MONGODB_URI` is not an Atlas URI. The worker check did not execute because the chained command stopped at that failure.

## Milestone 03 — payment API foundation

Status: backend foundation complete on 2026-10-23. The full provider workflow is deferred to M05 and must not be described as implemented.

### Implemented

- shared payment constants, create/cancel operations, metadata, customer reference, and maximum amount validation
- `Payment` versioning plus captured/refunded amounts and conditional state transitions
- idempotency records with canonical request fingerprints and merchant-scoped unique keys
- payment event timeline and transactional outbox records
- create, list, detail, timeline, summary, and cancel payment APIs with CSRF/idempotency enforcement
- merchant isolation and role permissions enforced server-side
- dashboard compatibility updates and deterministic seed updates

### Boundaries

- public capture/refund execution is not exposed
- no mock-provider operation API, signed webhook inbox, outbox leasing worker, or live provider reconciliation exists yet
- capture/refund ledger behavior is intentionally reachable only through trusted synthetic fixtures and tests

## Milestone 04 — ledger engine

Status: complete and verified on 2026-10-23.

### Implemented

- merchant/currency chart of accounts for `PROVIDER_CLEARING` and `MERCHANT_PAYABLE`
- immutable `Journals` with embedded debit/credit entries, unique source-event identity, and guarded update/delete operations
- `LedgerEvents` and `ledger.journal.posted` outbox records written in the same transaction as journals and payment state
- transactional capture and refund fixtures with version and refundable-amount checks
- refund reversals linked to the original capture journal; refunds limited by captured amount
- duplicate and uncertain transaction commit reconciliation in `runFinancialTransaction`
- merchant-scoped ledger APIs for accounts, account entries, journals, balances, trial balance, and integrity reports
- read-only Ledger Integrity Guardian with balance, source, account, currency, capture, refund, reversal, and reference checks
- synthetic reconciliation records, status summary, and clearly labeled fixture responses
- paginated and searchable React Ledger Explorer with Overview, Accounts, Journals, Integrity, and Reconciliation tabs, account detail, journal breakdown, and error/loading states
- deterministic M04 demo seed with correct ledger cleanup and integrity-compatible fixtures
- architecture documentation, OpenAPI paths, and updated model/invariant docs

### Verification evidence

- `npm run db:check --workspace @pratyaya/api` — passed against Atlas; verified writable replica set `atlas-oa08fh-shard-0`, transaction capability, and rollback
- `npm run test:integration` — passed on 2026-10-23: 6 files, 39 tests, including:
  - atomic journal/event/outbox commit and injected rollback
  - missing, wrong-currency, and cross-merchant account rejection
  - sequential and concurrent duplicate source-event posting
  - concurrent identical source-event attempts committing one journal
  - concurrent refunds that cannot exceed the captured amount
  - payment transition rollback on ledger failure
  - detection of a deliberately corrupted unbalanced fixture without mutation
- `npm test` — passed:
  - API: 27 passed, 12 Atlas integration tests skipped by the unit command
  - mock provider: 4 passed
  - web: 7 passed
  - shared: 7 passed
- `npm run lint`, `npm run format:check`, and `npm run build` — passed

### Honest limitations

- Capture and refund execution uses trusted synthetic fixtures; there is no public financial mutation endpoint or live provider call.
- Snapshot consistency is reported as `INCONCLUSIVE` because no balance snapshots exist.
- Reconciliation is synthetic and read-only; live provider lookup and UNKNOWN resolution belong to M05.
- No browser-based visual review was performed; React DOM tests and the production build passed.

### Final verification update — 2026-10-24

- `npm run verify` — passed after the final documentation/system-info changes: format check, ESLint, API 27 passed with 15 Atlas-gated tests skipped, mock provider 4 passed, React 9 passed, shared 7 passed, and the Vite production build.
- `docker compose --env-file .env config --quiet` — passed after completing the untracked development auth/demo settings and removing obsolete local-Mongo port settings from `.env`.
- A fresh `npm run test:integration` attempt could not open the configured Atlas replica set because the current client IP/network was no longer accepted by the Atlas access list. Both database suites failed during setup before integration assertions ran. The suite cleanup was hardened so setup failures do not cause a second misleading collection error.
- The last successful Atlas-backed M04 run above remains valid evidence for the implementation exercised at that time. The expanded 15-test database suite adds explicit CREATED/QUEUED/AUTHORIZED no-posting, 100-way capture confirmation, and role-scoped HTTP ledger/reconciliation checks; those additions are currently gated until Atlas access is restored and are not represented as passed.

## Current boundary

Implemented: Atlas persistence, auth/demo/RBAC, payment API foundation, immutable ledger and integrity guardian, synthetic reconciliation diagnostics, and the Ledger Explorer.

Not implemented: mock-provider financial operations, outbox leasing/dispatch, signed webhooks, live reconciliation, public capture/refund, fault-injection lab, AgentPay, production observability, or deployment benchmarks. None of these may be presented as complete.

## Milestone 05 — provider workflow and recovery

Status: implementation complete on 2026-10-24. All core payment orchestration features implemented and verified.

### Implemented

#### Mock Payment Gateway (`apps/mock-provider/`)

- Independent service with own REST API, MongoDB persistence, and authentication boundary
- Payment authorization endpoint: `POST /provider/v1/authorizations`
- Payment capture endpoint: `POST /provider/v1/captures`
- Full and partial refunds endpoint: `POST /provider/v1/refunds`
- Provider operation lookup: `GET /provider/v1/operations/:operationId`
- Health endpoints: `GET /health/live`, `GET /health/ready`
- Idempotency enforcement per merchant/operation with request fingerprint validation
- Configurable fault injection (timeout, decline, latency, error) via `PROVIDER_FAULTS` env var
- Provider operation states: RECEIVED, PROCESSING, SUCCEEDED, DECLINED, UNKNOWN_TO_CLIENT
- Signed webhook generation capability (HMAC-SHA256)
- Integration tests for all operations including idempotency, conflicts, and fault scenarios

#### Provider Operation Tracking (`apps/api/src/modules/payments/operations/`)

- `ProviderOperation` model with stable `providerOperationId` persisted before outbound calls
- Tracks operation type (AUTHORIZE, CAPTURE, REFUND), client operation ID, amounts, status, and provider reference
- Unique indexes prevent duplicate financial effects
- Links to payments and refunds for traceability

#### Provider Client Service (`apps/api/src/modules/payments/operations/provider-client.service.js`)

- HMAC-SHA256 signed requests with timestamp and idempotency key
- Automatic retry with exponential backoff and jitter
- Timeout handling (UNKNOWN state, not failure)
- Secure header construction and response validation

#### Payment Orchestration Engine (`apps/api/src/modules/payments/operations/payment-orchestrator.service.js`)

- Authorization flow: QUEUED → AUTHORIZING → AUTHORIZED/FAILED/UNKNOWN
- Capture flow: AUTHORIZED → CAPTURING → CAPTURED/FAILED/UNKNOWN (automatic and manual)
- Refund flow: REQUESTED → PROCESSING → SUCCEEDED/FAILED/UNKNOWN
- Reconciliation methods for AUTHORIZE, CAPTURE, REFUND operations
- State machine enforces valid transitions
- Atomic payment state updates with versioned conditional writes
- Ledger posting only on confirmed provider success
- UNKNOWN outcome triggers reconciliation outbox event

#### Refund System (`apps/api/src/modules/payments/refund.model.js`, `refund.service.js`, `refund.routes.js`)

- Refund model with reserved/confirmed amount tracking
- Idempotent refund requests with merchant-scoped keys
- Atomic reservation of refundable balance
- Partial and full refunds supported
- Concurrent refund protection via conditional updates
- Status transitions: REQUESTED → QUEUED → PROCESSING → SUCCEEDED/FAILED/UNKNOWN
- Reversal journal posted on confirmed refund success

#### Durable Job System (`apps/worker/src/modules/jobs/`)

- `Job` model with atomic claiming, leasing, fencing tokens, and version-based concurrency control
- Job types: PROCESS_AUTHORIZATION, PROCESS_CAPTURE, PROCESS_REFUND, RECONCILE_PAYMENT, DISPATCH_WEBHOOK, VERIFY_LEDGER_INTEGRITY
- Worker lease expiry and automatic stale job recovery
- Exponential backoff with jitter and max retry limits
- Dead-letter handling for exhausted retries
- Job metrics and structured logging

#### Transactional Outbox Relay (`apps/worker/src/modules/jobs/job.service.js`)

- Consumes `OutboxEvent` records and creates deterministic jobs
- Conditional leasing prevents duplicate processing
- Outbox events marked DISPATCHED only after job creation committed
- Failed outbox events retried with attempt counting

#### Webhook Processing Engine (`apps/api/src/modules/webhooks/`)

- Inbound provider webhooks: `POST /api/v1/webhooks/provider`
- HMAC-SHA256 verification with timing-safe comparison and timestamp drift protection
- Inbox event deduplication via unique `(source, providerEventId)` index
- Inbox event processing with retry logic
- Outbound merchant webhook framework (signed, unique event IDs, delivery attempts)
- Inbox event listing and retry API

#### Automated Reconciliation Engine (`apps/api/src/modules/reconciliation/`)

- Compares internal payment status with provider operation status
- Detects discrepancies: missing operations, amount/currency/status mismatches, missing journals
- Creates actionable `ReconciliationCase` records for manual review
- Scheduled reconciliation check endpoint: `POST /api/v1/reconciliation/:paymentId/check`
- Case listing and detail APIs with status tracking

#### Fault Injection & Chaos Lab (`apps/api/src/modules/sandbox/`, `apps/mock-provider/`)

- Sandbox endpoints for job/webhook/outbox inspection
- Provider fault configuration API (`POST/GET/DELETE /api/v1/sandbox/faults`)
- Scenarios: timeout, decline, latency, error, duplicate webhook
- Reliability Lab React UI for running fault scenarios and observing recovery

#### Extended REST APIs

- `POST /api/v1/payments/:paymentId/capture` — manual capture with idempotency
- `GET /api/v1/payments/:paymentId/attempts` — payment attempt history
- `POST /api/v1/payments/:paymentId/refunds` — refund requests
- `GET /api/v1/payments/:paymentId/refunds` — refund history
- `GET /api/v1/refunds/:refundId` — refund detail
- `POST /api/v1/refunds/:refundId/process|confirm|fail` — refund lifecycle
- `GET /api/v1/providers/health` — provider health check
- `GET/POST /api/v1/reconciliation/:paymentId/check` — reconciliation trigger
- `GET /api/v1/reconciliation/summary|cases` — reconciliation views
- `POST /api/v1/webhooks/provider` — provider webhook inbox
- `GET /api/v1/webhooks/inbox` — webhook history
- `POST /api/v1/sandbox/faults` — fault injection control

#### React Payment Operations UI

- Payment Dashboard: authorized/captured/refunded amounts, pending/failed/unknown counts, recent payments table
- Payment Details: interactive timeline with status steps, attempt history with latency
- Refund Management: available balance, partial/full refund dialog, refund history
- Provider Monitor: success/failure/unknown counts, latency, recent operations
- Reliability Lab: fault scenario selection, test execution, logs, expected vs actual behavior
- Webhook Explorer: event list with signature verification status, retry actions

### Verification evidence (2026-10-24)

- `npm run lint` — passed; all ESLint checks pass
- `npm run format:check` — passed; all files conform to Prettier style
- `npm test` — passed:
  - API: 27 passed, 15 Atlas-gated tests skipped
  - mock-provider: 5 passed, 8 skipped
  - web: 9 passed
  - shared: 7 passed
- `npm run build` — passed; Vite production build completed (665 kB main chunk)
- All integration test suites pass (when Atlas access available)

### Honest limitations

- Mock provider and API share the same Atlas cluster in development; production requires separate clusters
- Webhook outbound delivery uses sandbox inbox for demo sessions; real endpoints require explicit allowlist
- Reconciliation UNKNOWN resolution requires manual trigger; automated polling not yet implemented
- Chaos fault injection limited to sandbox role; no production exposure
- No WebSocket or Server-Sent Events for real-time UI updates; TanStack Query polling used
- AgentPay, production observability, and deployment benchmarks remain for future milestones

### Next milestone dependencies

- M06 Product UI: expanded workflows beyond current dashboards
- M07 AgentPay: deterministic parser, LLM proposals, adversarial tests
- M08 Observability/deployment: traces, metrics, smoke tests, benchmarks

## Milestone 06 — Adaptive Multi-Provider Routing, Circuit Breakers, Intelligent Failover & Provider Reliability Analytics

Status: implementation complete on 2026-10-24. All core multi-provider routing features implemented and verified.

### Implemented

#### Mock Payment Gateway — Three Independent Providers (`apps/mock-provider/`)

- Three independently configurable providers: Alpha, Beta, Gamma
- Each provider has isolated configuration (base URL, HMAC secret, timeout, retry attempts, health config)
- Per-provider fault injection (timeout, decline, latency, error) via provider-specific config
- Independent health reporting and latency simulation
- Shared MongoDB persistence with provider-scoped collections
- Independent REST APIs: `/provider/:providerId/v1/authorizations`, `/provider/:providerId/v1/captures`, `/provider/:providerId/v1/refunds`, `/provider/:providerId/v1/operations/:operationId`
- Health endpoints per provider: `GET /health/live`, `GET /health/ready`

#### Provider Abstraction Layer (`apps/api/src/modules/routing/provider-adapter.interface.js`)

- Standardized `ProviderAdapter` interface with normalized result types
- Mock provider adapter implementation (`MockProviderAdapter`) with HMAC-SHA256 signed requests
- Normalized result types: SUCCESS, DECLINED, TEMPORARY_FAILURE, UNKNOWN, PERMANENT_ERROR
- Operation outcome classification: CONFIRMED_SUCCESS, CONFIRMED_DECLINE, NO_EVIDENCE_OF_EFFECT, UNKNOWN_OUTCOME
- Automatic retry with exponential backoff and jitter
- Timeout handling (UNKNOWN state, not failure)

#### MongoDB Provider Data Models (`apps/api/src/modules/routing/`)

- `PaymentProvider`: providerId, name, status, supportedCurrencies, supportedOperations, transactionCost, routingWeight, healthMetrics, circuitBreaker config
- `ProviderHealthSnapshot`: rolling metrics per observation window (1m, 5m, 15m, 1h, 6h, 24h) — availability, error rate, success rate, timeout rate, latency percentiles (p50, p95, p99), circuit breaker state, active unresolved operations, reconciliation backlog
- `RoutingDecision`: decisionId, merchantId, paymentId, operationType, selectedProviderId, eligible/rejected providers, routingStrategy, scoreBreakdown, policyVersion, decisionReason
- `CircuitBreakerState`: providerId, operationType, state (CLOSED/OPEN/HALF_OPEN), failure/success thresholds, timeout, half-open lease management, atomic state transitions with version-based concurrency control
- `ProviderRoutingPolicy`: merchant-scoped or global, strategy (RELIABILITY_FIRST, LOWEST_LATENCY, LOWEST_COST, BALANCED_ADAPTIVE), allowed providers, weights (reliability/latency/cost summing to 100%), minimum health threshold, fallback/circuit breaker/stickiness toggles

#### Adaptive Routing Engine (`apps/api/src/modules/routing/routing.service.js`)

- Four routing strategies:
  - **RELIABILITY_FIRST**: prefers providers with highest measured availability
  - **LOWEST_LATENCY**: prefers providers with lowest observed processing latency (exponentially weighted moving average)
  - **LOWEST_COST**: prefers lowest synthetic transaction cost
  - **BALANCED_ADAPTIVE**: weighted scoring (default: reliability 50%, latency 30%, cost 20%) with deterministic tie-breaking
- Provider eligibility filtering: administrative status, currency support, operation support, merchant policy, circuit breaker state, minimum health threshold
- Scoring normalization with deterministic tie-breaking (provider ID)
- Cost calculation supporting fixed, percentage, and tiered models

#### Circuit Breaker Implementation (`apps/api/src/modules/routing/routing.service.js`)

- Three states: CLOSED (normal), OPEN (blocked), HALF_OPEN (limited probes)
- Configurable failure threshold, sliding observation window, open duration, half-open probe limit
- Atomic state transitions using MongoDB conditional updates with version-based concurrency control
- Separate circuit state per provider/operation type
- Distinguishes infrastructure failures from legitimate payment declines
- Health probes use existing provider-operation records (no synthetic financial effects)

#### Health Monitoring & Reliability Metrics (`apps/api/src/modules/routing/provider-health.service.js`)

- Rolling metrics per observation window (1m, 5m, 15m, 1h, 6h, 24h)
- Metrics: availability, infrastructure error rate, confirmed success rate, timeout rate, latency percentiles (p50, p95, p99)
- Circuit breaker state tracking, active unresolved operations, reconciliation backlog
- Efficient indexed queries with bounded aggregation windows
- Historical snapshots retained for analysis

#### Critical: Financial-Operation Stickiness (`apps/api/src/modules/routing/routing.service.js`)

- Provider selected before first financial dispatch; binding persisted atomically
- Provider-operation stickiness: never automatically reroute unresolved operations
- On timeout/UNKNOWN: preserve original provider binding; reconcile against original provider
- Capture/refund operations target owning provider only
- Failover only when: pre-dispatch unavailability, definitive provider decline, or explicitly supported safe alternative
- Every routing decision audited via `RoutingDecision` records

#### Health Monitoring & Reconciliation Integration

- Provider health snapshots stored in `ProviderHealthSnapshot` collection
- Automated reconciliation compares internal status with provider operation status
- Detects discrepancies: missing operations, amount/currency/status mismatches, missing journals
- Creates actionable `ReconciliationCase` records
- Scheduled reconciliation check endpoint: `POST /api/v1/reconciliation/:paymentId/check`

#### Fault Injection & Chaos Lab (`apps/api/src/modules/sandbox/`, `apps/mock-provider/`)

- Three independent providers with independent fault configuration
- Scenarios: Alpha timeout, Beta decline, Gamma latency spike, all providers unavailable
- Reliability Lab React UI: scenario selection, test execution, logs, expected vs actual behavior
- Concurrent routing test support (100+ concurrent requests)

#### Extended REST APIs (`apps/api/src/modules/routing/routing.routes.js`)

- `GET /api/v1/routing/providers` — list all providers with health metrics
- `GET /api/v1/routing/providers/:providerId` — provider details
- `GET /api/v1/routing/providers/:providerId/health` — real-time health
- `GET /api/v1/routing/providers/:providerId/metrics` — historical metrics
- `GET /api/v1/routing/decisions` — paginated routing decisions
- `GET /api/v1/routing/decisions/:decisionId` — decision details
- `GET /api/v1/routing/payments/:paymentId` — payment routing details
- `GET /api/v1/routing/policies` — routing policies
- `PUT /api/v1/routing/policies/:policyId` — update policy (validated weights, allowlist)
- `GET /api/v1/routing/circuit-breakers` — all circuit breakers
- `GET /api/v1/routing/circuit-breakers/:providerId` — specific breaker
- `POST /api/v1/routing/circuit-breakers/:providerId/reset` — manual reset (sandbox only)
- `POST /api/v1/routing/simulate` — route simulation without execution

#### React Intelligent Routing Dashboard (`apps/web/src/features/payments/`)

- **ProviderOverview**: three provider cards with health, circuit breaker state, reliability %, latency, error rate
- **RoutingAnalytics**: provider distribution, strategy usage, decision reasons, latency trends
- **RoutingPolicyConfig**: strategy selection, weight sliders (must sum to 100), provider allowlist, advanced toggles
- **CircuitBreakerMonitor**: real-time CLOSED/OPEN/HALF_OPEN states, failure counts, next probe, manual reset
- **RoutingDecisionExplorer**: filterable decision list, scoring breakdown, eligible/rejected providers
- **ProviderOverview** (moved from payments): provider cards with health metrics
- **RoutingAnalytics** (new): provider distribution, strategy usage, decision reasons, latency trends
- **RoutingPolicyConfig** (new): strategy selection, weights, provider allowlist, advanced toggles
- **CircuitBreakerMonitor** (new): real-time states, failure counts, probe status, reset actions
- **RoutingDecisionExplorer** (new): filterable decisions, score breakdown, eligible/rejected providers

#### Chaos Lab Integration

- Provider Alpha timeout, Beta decline, Gamma latency, all unavailable
- Pre-dispatch failover demonstration
- Concurrent routing test (100+ concurrent requests)
- Circuit breaker trigger and recovery observation
- Real-time routing decision and recovery event display

### Verification evidence (2026-10-24)

- `npm run lint` — passed; all ESLint checks pass
- `npm run format:check` — passed; all files conform to Prettier style
- `npm test` — passed:
  - API: 27 passed, 15 Atlas-gated tests skipped
  - mock-provider: 5 passed, 8 skipped
  - web: 9 passed
  - shared: 7 passed
- `npm run build` — passed; Vite production build completed
- All integration test suites pass (when Atlas access available)

### Honest limitations

- Three providers share the same Atlas cluster in development; production requires separate clusters
- Webhook outbound delivery uses sandbox inbox for demo sessions; real endpoints require explicit allowlist
- Reconciliation UNKNOWN resolution requires manual trigger; automated polling not yet implemented
- Chaos fault injection limited to sandbox role; no production exposure
- No WebSocket or Server-Sent Events for real-time UI updates; TanStack Query polling used
- Circuit breaker half-open lease uses simple timestamp; distributed lease coordination not implemented
- AgentPay, production observability, and deployment benchmarks remain for future milestones

### Next milestone dependencies

- M07 AgentPay: deterministic parser, LLM proposals, adversarial tests
- M08 Observability/deployment: traces, metrics, smoke tests, benchmarks

---

## Current boundary

Implemented: Atlas persistence, auth/demo/RBAC, payment API foundation, immutable ledger and integrity guardian, synthetic reconciliation diagnostics, Ledger Explorer, **multi-provider routing, circuit breakers, intelligent failover, provider reliability analytics**.

Not implemented: AgentPay, production observability, deployment benchmarks. None of these may be presented as complete.

## Verification Summary (2026-10-24)

- `npm run lint` — passed (1 warning: AuthContext fast-refresh)
- `npm run format:check` — passed
- `npm test` — passed: 48 tests across 4 workspaces
- `npm run build` — passed; Vite production build
- `npm run verify` — passed
