# Testing and verification

Run from the repository root:

```bash
npm run verify
npm run test:integration
npm run seed:demo
```

`npm run verify` formats-checks, lints, runs unit/component/API contract tests, and builds the Vite application. `npm run test:integration` requires the untracked Atlas `MONGODB_URI`, executes files serially because they share the default Mongoose connection, and verifies replica-set transactions, rollback, idempotency, 100-way capture contention, competing refunds, API authorization, demo isolation, and corruption detection.

The integration suite creates uniquely identified test records and removes them afterward. It also refreshes the deterministic synthetic demo data used by authenticated API tests. Never point the tests at a real-money or production customer database.

`npm run db:check` checks core API, mock-provider, and worker Atlas connectivity. It requires both `MONGODB_URI` and the independently scoped `PROVIDER_MONGODB_URI`; no credential is committed to Git.
