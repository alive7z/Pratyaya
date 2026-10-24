# Implementation progress

Last reviewed: 2026-10-24.

## Current scope

M01–M11 code exists for workspace/process foundations, Atlas persistence, auth/RBAC/demo roles, payments/idempotency, ledger/integrity, mock-provider operations, MongoDB durable work, webhooks/reconciliation, routing/risk, AgentPay, and React operations views.

M12 repository preparation now includes:

- `vercel.json` and a server-only same-origin `/api` proxy
- `render.yaml` with API, provider, and paid persistent worker services
- production `PORT`, HTTPS-cookie, trust-proxy, CORS, provider URL, and signing-secret handling
- HMAC authentication on mock-provider operation routes
- explicit provider operation identity before dispatch
- conditional outbox leasing and deterministic job creation
- exact provider index migration for a discovered obsolete Atlas index
- deployment configuration validation and a four-role hosted smoke script
- professional README, Mermaid diagrams, deployment/cost guidance, and verified-evidence document

## Defects found and corrected during M12 review

- worker imported the payment orchestrator through an invalid path and called a nonexistent config loader
- API/worker lacked required provider URL/signing configuration; web processes did not consistently honor hosting `PORT`
- provider operation routes did not validate request bodies and did not authenticate API signatures
- provider errors were flattened to HTTP 500 rather than retaining operational status/code
- provider queries and uniqueness were not scoped by provider ID
- frontend capture/cancel/refund idempotency headers were passed as an ignored argument
- frontend login/demo did not update authentication context; logout did not call the API
- outbox relay read before leasing and could generate random duplicate jobs
- provider operation IDs were blank until a response, preventing safe lost-response lookup
- Atlas contained an obsolete unique provider index; an idempotent exact-key migration now removes it
- duplicate Mongoose index declarations produced startup warnings

## Verification observed so far

- API Atlas integration suite: 42/42 tests passed in 48.61 seconds before the final documentation pass.
- Mock-provider Atlas integration suite: 14/14 tests passed in 5.36 seconds after route and index-migration fixes.
- Atlas `db:check`: API, provider, and worker connections each verified replica-set transaction rollback.
- Deployment configuration check passed before the final documentation pass.

Final formatting, lint, unit/component tests, build, full integration rerun, Compose validation, local process smoke, and secret scan remain to be recorded after this file is formatted. Counts will be copied to `RESUME_EVIDENCE.md` only after those commands complete.

## External deployment status

Not deployed from this workspace. Vercel/Render account access, billing authorization, final Atlas production users/network rules, and public URLs were not provided. Consequently:

- no working public URL is claimed
- no hosted smoke result is claimed
- no screenshots are claimed
- no production performance/uptime numbers are claimed

## Open engineering issues

1. Provider HTTP waits currently occur inside local MongoDB orchestration transaction callbacks. Split dispatch and result application into separate transaction phases before calling the design production-hardened.
2. The configured development Atlas core/provider URIs currently resolve to a database named `test`; hosted environments need distinct database names/users, preferably isolated clusters.
3. Browser E2E/accessibility automation and verified screenshots are absent. Current frontend evidence is component/jsdom tests, builds, and HTTP smoke.
4. A real deployment still requires platform account actions and the hosted smoke command.
