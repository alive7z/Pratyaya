# Pratyaya — Intelligent Payment Reliability & Agentic Authorization Platform

Pratyaya is a backend-first, full-stack simulator for exploring payment correctness under failure. It uses synthetic data only and never processes real money, cards, bank accounts, or personal payment credentials. It is not PCI compliant and is not affiliated with or endorsed by Visa.

## Current status — M04 ledger engine

Pratyaya runs on MongoDB Atlas (no local Docker MongoDB required). Implemented:

- npm workspaces for the API, worker, mock provider, React app, and shared contracts
- Node.js 24 LTS and JavaScript ES modules throughout
- Express API with configuration validation, graceful shutdown, request IDs, structured redacted logs, Helmet, restricted CORS, rate limiting, body limits, consistent envelopes, HttpOnly cookies, CSRF protection, and secure auth flows
- MongoDB Atlas + Mongoose lifecycle with buffering disabled, bounded connection options, transaction verification, and graceful disconnect
- Credential-free demo sessions on both Login and Register: `Explore as Merchant`, `Explore as Admin`, `Explore as Developer`, and `Explore as Risk Analyst`
- Real backend demo sessions with role permissions, revocation, expiry, IP quotas, audit logging, and sandbox isolation
- Registration, login, logout, JWT access tokens, secure refresh-token rotation, MongoDB-persisted sessions, merchant memberships, RBAC, protected routes, and audit logging
- Role-specific dashboards (Merchant, Admin, Developer, Risk Analyst) with seeded synthetic data and clear "upcoming" labeling where features are not yet built
- Admin dashboard restricted to demo sandbox data
- Payment API foundation: idempotent create/cancel, versioned state transitions, event timeline, outbox records, merchant isolation, and RBAC
- Immutable double-entry ledger with balanced capture/refund journals, linked refund reversals, derived balances, and trial balance
- Merchant-scoped Ledger Explorer with account details, searchable journals, debit/credit breakdown, integrity reports, and synthetic reconciliation diagnostics
- Read-only Ledger Integrity Guardian covering balance, references, currency, capture/refund, reversal, and duplicate checks
- Explicit boundary: capture/refund journal posting is exercised only through trusted synthetic fixtures and tests; no public financial mutation or live provider call is active
- API liveness, Atlas-backed readiness, non-secret system information, and OpenAPI UI
- Independently runnable worker and mock-provider against their own Atlas databases
- React/Vite/Tailwind app with premium white/blue theme, dark mode, auth flows, explore roles, and role dashboards
- Unit tests, API tests, integration tests (replica-set transactions), and frontend tests

## Architecture

```text
React SPA
    |
    v
Express API ------ MongoDB Atlas replica set (authoritative Pratyaya state)
                         |
                         | transactional outbox
                         v
Worker -----------------+
    |
    | HTTP provider workflow in M05
    v
Mock provider ------ separate MongoDB Atlas cluster/database
```

MongoDB Atlas is authoritative. Financial operations require a replica-set topology for multi-document ACID transactions. Durable work will initially use MongoDB outbox documents and conditional leases; Redis/BullMQ are optional and can use a managed Redis service if workers need them.

Money crosses APIs as positive decimal strings of integer minor units. Financial persistence uses BSON `BigInt` (or safe string conversions at document boundaries), while arithmetic uses JavaScript `BigInt`. Floating-point currency arithmetic is forbidden.

Read [PAYCORE_ARCHITECTURE.md](PAYCORE_ARCHITECTURE.md), [docs/architecture.md](docs/architecture.md), [docs/architecture/ledger.md](docs/architecture/ledger.md), and [docs/financial-invariants.md](docs/financial-invariants.md) before implementing payment behavior.

## Repository layout

```text
apps/
  api/            Express API, Mongoose lifecycle, health/system modules
  worker/         MongoDB-connected worker and health foundation
  mock-provider/  isolated simulated-provider process and database connection
  web/            React, Vite, Tailwind dashboard
packages/shared/  Zod contracts, constants, integer-money helpers
docs/             architecture, model, security, API, decisions, roadmap, progress
compose.yaml      optional application-only Compose services (no MongoDB)
infra/docker/     container images and web proxy configuration
```

## Prerequisites

- Node.js 24 LTS and npm 11+
- Two MongoDB Atlas replica-set clusters that support multi-document transactions (recommended: separate cluster/project for provider, or two distinct databases with separate credentials). Atlas Serverless is not suitable.
- Optional: managed Redis service if BullMQ workers are enabled

## Atlas quick start

```bash
cp .env.example .env
# Set MONGODB_URI and PROVIDER_MONGODB_URI to your Atlas SRV URIs
npm ci
npm run db:check
npm run dev
```

Open:

| Service         | URL                                |
| --------------- | ---------------------------------- |
| Dashboard       | http://localhost:5173 / :8080      |
| API             | http://localhost:4000              |
| OpenAPI         | http://localhost:4000/api-docs     |
| Worker health   | http://localhost:4200/health/ready |
| Provider health | http://localhost:4100/health/ready |

`npm run db:check` verifies connectivity, replica-set topology, and ACID transaction capability for both the core and provider Atlas databases. Use separate clusters/projects for stronger isolation.

## Local application development

```bash
cp .env.example .env
# Add MONGODB_URI and PROVIDER_MONGODB_URI from MongoDB Atlas
npm ci
npm run db:check
npm run dev
```

`npm run dev` starts the API, worker, provider, and Vite. Put Atlas `mongodb+srv://...` URIs only in the ignored `.env` file; never commit or print them. For full infrastructure isolation, use a separate Atlas cluster/project for the mock provider.

## Commands

| Command                    | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `npm run dev`              | Start all application processes with watch mode                  |
| `npm run dev:api`          | Start only the API                                               |
| `npm run dev:worker`       | Start only the worker foundation                                 |
| `npm run dev:provider`     | Start only the mock provider                                     |
| `npm run dev:web`          | Start only Vite                                                  |
| `npm run db:check`         | Verify Atlas connectivity, replica set, and transaction rollback |
| `npm run seed:demo`        | Seed deterministic synthetic data for Explore/demo dashboards    |
| `npm run format`           | Format tracked source/configuration files                        |
| `npm run format:check`     | Check formatting without writing                                 |
| `npm run lint`             | Run ESLint                                                       |
| `npm test`                 | Run workspace tests                                              |
| `npm run test:integration` | Run API tests against configured MongoDB                         |
| `npm run build`            | Build the web application                                        |
| `npm run verify`           | Format check, lint, tests, and build                             |
| `npm run docker:up`        | Optional: build/run Compose stack (if used)                      |
| `npm run docker:down`      | Stop the Compose stack                                           |

## API endpoints

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`
- `GET /api/v1/system/info`
- `GET /api/v1/payments`
- `POST /api/v1/payments` (idempotency + CSRF)
- `GET /api/v1/payments/{paymentId}`
- `GET /api/v1/payments/{paymentId}/timeline`
- `GET /api/v1/payments/summary`
- `POST /api/v1/payments/{paymentId}/cancel` (idempotency + CSRF)
- `GET /api/v1/demo/roles`
- `POST /api/v1/demo/session`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/dashboard/merchant`
- `GET /api/v1/dashboard/admin`
- `GET /api/v1/dashboard/developer`
- `GET /api/v1/dashboard/risk`
- `GET /api/v1/ledger/accounts`
- `GET /api/v1/ledger/accounts/{accountId}`
- `GET /api/v1/ledger/accounts/{accountId}/entries`
- `GET /api/v1/ledger/journals` (currency, event, account, date, search, pagination)
- `GET /api/v1/ledger/journals/{journalId}`
- `GET /api/v1/ledger/balances`
- `GET /api/v1/ledger/trial-balance`
- `POST /api/v1/ledger/integrity/check` (authorized + CSRF)
- `GET /api/v1/ledger/integrity/reports`
- `GET /api/v1/ledger/integrity/reports/{reportId}`
- `GET /api/v1/reconciliation`
- `GET /api/v1/reconciliation/{recordId}`
- `GET /api/v1/audit-logs`
- `GET /api-docs`
- `GET /api-docs/openapi.json`

Ledger reads are merchant-scoped. Integrity checks require admin or auditor permission. Reconciliation responses are explicitly synthetic. Public capture/refund execution and provider calls are not active. See [docs/api-conventions.md](docs/api-conventions.md).

## Explore Pratyaya instantly

Open `/login` or `/register` and use **Explore Pratyaya Instantly** to enter the sandbox as Merchant, Admin, Developer, or Risk Analyst without credentials. Demo sessions are credential-free, revocable, short-lived, role-scoped, and limited to synthetic data.

## Verification evidence

Actual commands, failures, fixes, and results are recorded in [docs/PROGRESS.md](docs/PROGRESS.md). No benchmark or payment metric shown in demo dashboards is represented as observed production data.
