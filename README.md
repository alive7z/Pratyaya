<div align="center">

# PRATYAYA

### Trust in Every Transaction.

**An engineering playground for the moments when payments don't go as planned.**

<p>
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-18181B?style=for-the-badge&logo=javascript&logoColor=F7DF1E" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18181B?style=for-the-badge&logo=nodedotjs&logoColor=5FA04E" />
  <img alt="React" src="https://img.shields.io/badge/React-18181B?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB_Atlas-18181B?style=for-the-badge&logo=mongodb&logoColor=47A248" />
</p>

<p>
  <img alt="Simulated payments" src="https://img.shields.io/badge/Payments-Simulation_Only-2563EB?style=flat-square" />
  <img alt="Backend first" src="https://img.shields.io/badge/Focus-Backend_%2B_Reliability-475569?style=flat-square" />
  <img alt="JavaScript codebase" src="https://img.shields.io/badge/Codebase-JavaScript-475569?style=flat-square" />
</p>

[The idea](#the-idea) · [Explore the sandbox](#explore-the-sandbox) · [How it works](#how-it-works) · [Reliability Lab](#break-a-payment-on-purpose) · [Run locally](#run-it-locally) · [Security](#security-first-even-in-a-sandbox)

</div>

---

## The idea

Most payment demos show a checkout button, a spinner, and a green **Payment successful** message.

But what if the payment *did* succeed and the network response never arrived? What if someone clicked **Pay** five times? What happens if a worker stops halfway through a refund?

That's the part I wanted to explore with **Pratyaya**.

Pratyaya is a **backend-first, full-stack fintech simulation** focused on making payment behavior understandable, recoverable, and auditable. It brings together a React operations dashboard, an Express API, MongoDB-backed financial records, simulated payment providers, and controlled failure experiments.

> [!IMPORTANT]
> **No real money moves through Pratyaya.** Payments, customers, providers, invoices, and balances are synthetic. This is an independent engineering project, not a payment network, banking service, or PCI-certified product.

### The questions behind the project

| Question | Engineering approach |
| :-- | :-- |
| What if the same request arrives 100 times? | Merchant-scoped **idempotency keys**, request fingerprints, and unique MongoDB indexes. |
| What if the provider succeeds but times out? | Preserve the original operation ID, mark the outcome **uncertain**, and reconcile before retrying. |
| How do we know the money adds up? | **Double-entry journals** where total debits equal total credits. |
| What if a background worker crashes? | Durable jobs, leases, retries, and recovery rather than an in-memory queue. |
| Which provider should handle a new payment? | Explainable routing based on health, latency, and synthetic cost—without unsafe failover. |
| Can an AI agent pay an invoice on its own? | It can propose a payment; deterministic policies and **human approval** control execution. |

## Explore the sandbox

Pratyaya is designed to be approachable even if you don't have an account. The intended demo experience offers **one-click, credential-free access** on the Login and Register pages, with an isolated sandbox for each role.

| Choose a perspective | What to explore |
| :-- | :-- |
| **Merchant** | Create simulated payments, track their state, inspect captures and refunds, and understand the ledger. |
| **Admin** | Review sandbox operations, reconciliation issues, provider health, and integrity reports. |
| **Developer** | Inspect API behavior, idempotency, webhooks, traces, and controlled failure experiments. |
| **Risk Analyst** | Review unusual payment patterns, explainable risk decisions, and transaction investigations. |

**No email, password, or OTP should be needed for these demo paths.** Standard authenticated accounts are a separate experience. Demo permissions must still be enforced by the backend.

<details>
<summary><strong>What's a good 60-second tour?</strong></summary>

1. Choose **Explore as Developer** from the application's Login or Register screen.
2. Open the **Payments** workspace and create a fictional INR payment.
3. Retry the same request with its original `Idempotency-Key` and check that it stays one logical payment.
4. Follow its **Transaction Time Machine** timeline: request → worker → provider → result → ledger.
5. Run an authorized **provider timeout** scenario in the Reliability Lab.
6. Inspect the reconciliation decision and the financial integrity check.

The availability of individual screens depends on which milestones have been implemented. See the code and `docs/PROGRESS.md` for verified progress.

</details>

## What Pratyaya is designed to do

<details open>
<summary><strong>01 · Payment core — correctness before speed</strong></summary>

- Accept simulated payment intents through validated, merchant-scoped REST APIs.
- Prevent duplicate logical operations with idempotency records and database constraints.
- Follow explicit authorization, capture, failure, cancellation, and refund states.
- Use integer **minor currency units** (for example, `125000` paise = ₹1,250.00), not floating-point money.
- Separate confirmed provider outcomes from **unknown** outcomes.

</details>

<details>
<summary><strong>02 · Financial ledger — every movement has a matching entry</strong></summary>

- Post balanced debit/credit journals for confirmed simulated captures and refunds.
- Keep posted journals append-only through application permissions and correction entries.
- Link each journal to the operation that caused it.
- Check for duplicate postings, missing journals, currency mismatches, and refund overages.

</details>

<details>
<summary><strong>03 · Resilience — the system should survive a bad day</strong></summary>

- Persist jobs and outbox events in MongoDB.
- Recover abandoned work through leases and stable operation IDs.
- Process signed webhooks with replay and duplicate-event protection.
- Reconcile payment outcomes that cannot safely be classified as success or failure.
- Simulate provider delays, declines, outages, duplicate webhooks, and worker crashes.

</details>

<details>
<summary><strong>04 · Intelligent routing — choose carefully, fail over safely</strong></summary>

- Compare simulated providers using observed availability, latency, and configured cost.
- Explain *why* a provider was selected.
- Use circuit breakers to avoid sending new work to unhealthy providers.
- **Never blindly reroute an already-dispatched payment after a timeout.**

</details>

<details>
<summary><strong>05 · AgentPay — AI suggests, people authorize</strong></summary>

- Extract proposed details from synthetic invoices.
- Check supplier allowlists, spending limits, duplicate invoices, and risk rules.
- Require explicit human approval tied to the exact payment details.
- Prevent an AI response from becoming an execution permission.

</details>

## How it works

The architecture keeps the UI, financial source of truth, background processing, and mock payment network separate. The default plan is a **modular monolith with independently runnable workers/providers**, not a maze of unnecessary microservices.

```mermaid
flowchart TD
    UI["React dashboard"] --> API["Express API"]
    API --> AUTH["Authentication + merchant-scoped RBAC"]
    AUTH --> CORE["Payment orchestration + idempotency"]
    CORE --> DB[("MongoDB Atlas")]
    CORE --> OUT["Transactional outbox"]
    OUT --> WORKER["Durable MongoDB worker"]
    WORKER --> ROUTE["Routing + risk rules"]
    ROUTE --> PROVIDER["Independent mock providers"]
    PROVIDER -->|"Confirmed result or uncertain outcome"| WORKER
    WORKER --> RECON["Reconciliation"]
    RECON --> DB
    RECON --> LEDGER["Double-entry ledger + audit trail"]
    LEDGER --> DB
    DB --> API
    API --> UI
```

### An important payment rule

A timeout is **not** a confirmed failure. If a provider processed the payment but the response was lost, Pratyaya must first check what happened to the **original provider operation**. Sending a fresh payment to another provider could cause a duplicate economic effect.

```mermaid
sequenceDiagram
    participant M as Merchant / React
    participant A as Pratyaya API
    participant W as Durable worker
    participant P as Mock provider
    participant D as MongoDB ledger
    M->>A: POST /payments + Idempotency-Key
    A->>D: Atomically store payment + outbox
    A-->>M: Accepted + stable payment reference
    W->>P: Capture using stable operation ID
    P->>P: Persist simulated capture
    Note over P,W: Provider response is lost
    W->>D: Record uncertain outcome
    W->>P: Look up original operation ID
    P-->>W: Capture confirmed
    W->>D: Atomically finalize + post balanced journal
    M->>A: GET /api/v1/payments/{id}
    A->>D: Read committed payment state
    D-->>A: Captured status + journal reference
    A-->>M: Current status + timeline
```

## Break a payment on purpose

The **Reliability Lab** is meant to make failure visible. Instead of claiming that the system is reliable, the goal is to **test it and show the evidence**.

<details>
<summary><strong>Scenario A — I clicked Pay five times. Was I charged five times?</strong></summary>

**Inject:** Repeated concurrent requests with the same idempotency key and payload.

**Expected:** One logical payment; later requests receive the previous result or an in-progress response. Reusing that key for a different payload returns a conflict.

**Evidence to inspect:** Request results, idempotency record, payment count, provider operation count, and related journal count.

</details>

<details>
<summary><strong>Scenario B — The provider charged successfully, then disappeared.</strong></summary>

**Inject:** The mock provider persists a successful capture, but its response never reaches the worker.

**Expected:** The local operation remains uncertain, the worker queries the original operation ID, and a confirmed capture is recorded **once**. No blind rerouting.

**Evidence to inspect:** Provider reference, retry attempts, reconciliation trace, and balanced journal.

</details>

<details>
<summary><strong>Scenario C — A worker crashes in the middle of a refund.</strong></summary>

**Inject:** Terminate a dedicated sandbox worker after its operation is dispatched.

**Expected:** Its lease expires, another worker resumes from durable state, and no extra refund is created. Uncertain refunds keep their balance reservation until resolved.

**Evidence to inspect:** Job ownership, lease history, provider operation ID, refund status, and ledger integrity report.

</details>

<details>
<summary><strong>Scenario D — Every provider looks unhealthy.</strong></summary>

**Inject:** Place the mock providers in simulated outage or circuit-open states.

**Expected:** New unbound operations are safely delayed or rejected. Existing uncertain operations retain their original provider binding for reconciliation.

**Evidence to inspect:** Provider health, routing decision, circuit state, and absence of unintended financial effects.

</details>

## The accounting idea, without the jargon

When a fictional ₹1,000 payment is **confirmed captured**, the accounting model records the effect on both sides:

| Account | Debit | Credit |
| :-- | --: | --: |
| Provider clearing (asset) | ₹1,000 | — |
| Merchant payable (liability) | — | ₹1,000 |
| **Total** | **₹1,000** | **₹1,000** |

A confirmed refund creates a corresponding reversing journal. Merely authorizing a payment does **not** mean the money has been captured.

<details>
<summary><strong>Why not just store a balance field?</strong></summary>

Because a balance tells you *how much* but not necessarily *why*. A journal tells you which economic event caused the change, which accounts moved, and whether the movement balanced. Derived balances can always be rebuilt from confirmed journals. MongoDB transactions, uniqueness constraints, and controlled corrections are used to protect that record.

</details>

## Technology stack

| Part | Tools |
| :-- | :-- |
| Client | React, Vite, JavaScript, Tailwind CSS, TanStack Query |
| API | Node.js, Express, Zod, JWT, RBAC |
| Data | MongoDB Atlas, Mongoose, multi-document transactions |
| Async processing | MongoDB transactional outbox, durable job leases, retries |
| Payment network | Independent Node.js mock providers and signed webhooks |
| Testing | Vitest, Supertest, Playwright; reproducible concurrency/fault tests |
| Delivery | Docker for local reproducibility, GitHub Actions, Vercel + compatible Node hosting |

### Repository layout

The intended workspace layout is:

```text
pratyaya/
├── apps/
│   ├── web/             # React application
│   ├── api/             # Express business API
│   ├── worker/          # Background jobs and reconciliation
│   └── mock-provider/   # External payment simulation
├── packages/
│   └── shared/          # Shared constants / validation
├── docs/                # Design notes, API docs, progress
├── tests/               # Integration and failure scenarios
├── .github/workflows/    # CI
└── package.json         # npm workspaces
```

The worker may share a backend runtime in smaller deployments; consult the actual repository before deploying separate services.

## Run it locally

**Prerequisites:** A supported Node.js LTS release, npm, and a MongoDB Atlas connection (or a local MongoDB replica set for transaction testing).

```bash
# Clone your own Pratyaya repository, then:
cd pratyaya
npm install

# Inspect available workspace scripts before starting services:
npm run
```

Copy the project's `.env.example` file(s) to local, untracked `.env` file(s), then configure the required variables. Environment variable names should match the actual implementation. Typical configuration includes:

```dotenv
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_ACCESS_SECRET=generate_a_strong_secret_locally
JWT_REFRESH_SECRET=generate_a_different_strong_secret
MOCK_PROVIDER_URL=http://localhost:4100
MOCK_PROVIDER_WEBHOOK_SECRET=generate_another_strong_secret
APP_ORIGIN=http://localhost:5173
```

> [!NOTE]
> MongoDB transactions require a replica set. MongoDB Atlas provides this in supported deployments. Keep the Atlas connection string and all signing secrets **server-side**; never place them in Vite client environment variables.

Run the development scripts exposed in your `package.json`. The intended npm-workspace setup includes the API, React app, worker, and mock provider. For tests and builds, these commands work when corresponding workspace scripts have been configured:

```bash
npm run test --workspaces --if-present
npm run build --workspaces --if-present
```

For exact endpoints and startup commands, use the repository's OpenAPI specification and `package.json` scripts rather than assuming example URLs are the deployed API.

<details>
<summary><strong>Example: what does an idempotent API request look like?</strong></summary>

Illustrative request contract (adjust local host/port and authentication to the running API):

```http
POST /api/v1/payments HTTP/1.1
Authorization: Bearer YOUR_SANDBOX_ACCESS_TOKEN
Idempotency-Key: demo-payment-001
Content-Type: application/json

{
  "amountMinor": 125000,
  "currency": "INR",
  "description": "Synthetic checkout payment"
}
```

Retrying the **same logical request** should reuse the same key. A new intended payment gets a new key. A conflicting payload with an existing key must not create another payment.

</details>

## Security first, even in a sandbox

- **Synthetic data only.** No real card numbers, CVV, banking credentials, or money movement.
- **Tenant boundaries matter.** Merchant identity and permissions must be checked on the server.
- **AI cannot authorize payments.** AgentPay suggestions require deterministic policies and explicit human approval.
- **Webhooks are untrusted until verified.** Validate signatures, timestamps, and event identities.
- **Failures should be explainable.** Keep operation references, journal links, and redacted audit records.
- **Chaos tools belong in isolated demo environments.** No unrestricted fault injection against live systems.
- **No compliance claims.** The project is not certified or represented as production-ready financial infrastructure.

## Engineering evidence, not marketing numbers

This project is designed to produce reproducible evidence—not invented metrics. Useful experiments include:

| Test target | What to verify |
| :-- | :-- |
| 100 same-key concurrent requests | One logical payment and no duplicate economic effect |
| Timeout after provider success | Recovery by original provider operation ID |
| Worker crash during execution | Durable job recovery without duplicate capture/refund |
| Duplicate webhook delivery | One authorized financial posting |
| Partial refund race | Total refunds never exceed captured value |
| Ledger integrity scan | Every posted journal balances for its currency |

**These are validation targets, not published test results.** Add actual commands, dates, sample sizes, and observed results to `docs/PROGRESS.md` or `docs/TEST_REPORT.md` after running them.

## Project direction

Pratyaya is being developed in milestones: identity and sandbox access → payment engine → ledger → mock providers and recovery → adaptive routing → reliability experiments → explainable risk → AgentPay → frontend polish → test/CI hardening → deployment.

The architecture describes intended capabilities. **The current source code and verified progress report determine what is actually available.** Avoid presenting a design goal as a shipped feature.

<details>
<summary><strong>FAQ — Is Pratyaya a real payment gateway?</strong></summary>

No. It's a learning and demonstration environment for payment-system engineering. Every payment and financial record is fictional.

</details>

<details>
<summary><strong>FAQ — Why MongoDB instead of a relational database?</strong></summary>

MongoDB Atlas simplifies managed deployment for this project while supporting multi-document transactions. It does not automatically make financial operations safe; indexes, transactional boundaries, immutable journal rules, and reconciliation still have to be designed and tested carefully.

</details>

<details>
<summary><strong>FAQ — Why not just retry a failed payment?</strong></summary>

Because "request timed out" and "payment failed" are not the same thing. Retrying with a new operation identity can repeat an effect the provider has already committed. Pratyaya is designed to preserve operation identity and reconcile uncertain results first.

</details>

---

<div align="center">

### Built to understand the hard parts of payments.

**Pratyaya** · *Trust in Every Transaction.*

An independent full-stack fintech engineering project by [@alive7z](https://github.com/alive7z).

</div>
