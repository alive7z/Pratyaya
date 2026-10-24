# System architecture

Pratyaya uses a modular monolith with independently runnable process boundaries. The API owns domain orchestration and authoritative state. The worker will lease MongoDB outbox documents. The mock provider remains a separate HTTP and persistence boundary. MongoDB Atlas is used by the API, worker, and mock provider.

## Process responsibilities

| Process       | Current responsibility                                             | Later responsibility                             |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| Web           | auth/demo flows, role dashboards, ledger explorer, health display  | payment execution, reconciliation workflows      |
| API           | auth, RBAC, payments foundation, immutable ledger, integrity reads | provider workflow, webhooks, live reconciliation |
| Worker        | Mongo lifecycle and health                                         | outbox leases, provider calls, recovery jobs     |
| Mock provider | isolated lifecycle and health                                      | idempotent synthetic operations and fault modes  |

## Persistence

Pratyaya uses Mongoose against MongoDB Atlas. Buffering is disabled so disconnected operations fail instead of silently waiting. Pool sizes and selection/connect/socket timeouts are explicit. Application processes connect once during startup and disconnect during graceful shutdown.

Both databases must run on Atlas replica sets. Use separate clusters or projects for the core API/worker database and the mock provider database for stronger infrastructure isolation. Two databases in the same cluster are logically separated but share infrastructure.

## Ledger and durable work

`docs/architecture/ledger.md` defines the double-entry engine. Payment state, immutable journals, ledger events, and an outbox document are written in one MongoDB transaction. A worker will claim due documents using a conditional atomic update over `state`, `availableAt`, and an expired `leaseUntil`. Crash recovery may redeliver work, so consumers remain idempotent. Redis/BullMQ can use a managed Redis service if durable workers require it.

The current M04 integrity guardian is read-only. Reconciliation records are explicitly synthetic fixtures until live provider lookup is implemented. See `docs/architecture/reconciliation.md`.

## Deployment direction

The static frontend can deploy to Vercel. API, worker, and provider require independent Node.js process hosting such as Render. MongoDB Atlas supplies the hosted replica-set topology. Managed Redis can be used if BullMQ workers are enabled. Deployment configuration is planned after core correctness tests.
