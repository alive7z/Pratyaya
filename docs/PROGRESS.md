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
