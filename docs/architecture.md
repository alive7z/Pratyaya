# System architecture

Pratyaya is a synthetic payment lab built as an npm-workspace monorepo. The Express API is a modular monolith; the React frontend, persistent worker, and mock provider are independent runtimes. MongoDB Atlas is authoritative. Redis is not used.

| Runtime       | Responsibility                                                                           | Persistence             |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| Web           | Accessible operations UI and four demo-role entry points                                 | None; calls `/api`      |
| API           | Authentication, authorization, payments, ledger, risk, reconciliation, routing, AgentPay | Core Atlas database     |
| Worker        | Conditional outbox/job leasing, retries, provider dispatch, recovery                     | Core Atlas database     |
| Mock provider | HMAC-authenticated synthetic authorizations, captures, refunds, and faults               | Provider Atlas database |

The API creates business state and an outbox event in the same MongoDB transaction. Workers may deliver more than once; deterministic job IDs, provider idempotency, webhook inbox uniqueness, and ledger business keys prevent duplicated business effects. No global exactly-once claim is made.

Provider operation identity is stored before dispatch. A timeout produces `UNKNOWN`; reconciliation queries the same operation instead of blindly rerouting it. Confirmed captures/refunds and balanced ledger journals commit atomically on the Pratyaya side. No transaction spans the provider boundary.

Deployment uses Vercel for the static SPA and same-origin proxy, Render web services for API/provider, a Render background worker, and Atlas. Details and limitations are in `docs/deployment.md`.
