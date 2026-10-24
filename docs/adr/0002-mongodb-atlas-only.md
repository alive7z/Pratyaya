# ADR 0002: MongoDB Atlas-only persistence

Status: accepted for Milestone 02

## Context

MongoDB is authoritative and financial effects require multi-document ACID transactions. Running a local Docker MongoDB replica set adds operational differences from production, requires Docker for verification, and makes it easy to verify against a topology that is not the deployment target.

## Decision

Use MongoDB Atlas for the API/worker database and for the mock provider. Both connection strings are environment-only:

- `MONGODB_URI` for the authoritative Pratyaya database.
- `PROVIDER_MONGODB_URI` for the isolated mock-provider database.

`npm run db:check` verifies connectivity, replica-set topology, and transaction rollback for all databases. GitHub Actions runs Atlas-backed checks and integration tests only when repository secrets are configured. Docker Compose may run application processes but must not start MongoDB.

Use separate Atlas clusters or projects for stronger isolation; distinct databases within one cluster are acceptable only when credentials and collection namespaces enforce separation.

## Consequences

- Local development and CI require Atlas credentials for database-backed verification.
- No application process starts without a valid Atlas URI.
- Credentials must never be committed, logged, returned by `/system/info`, or included in screenshots.
- Atlas must remain a replica-set topology that supports multi-document transactions; standalone and Atlas Serverless deployments are unsuitable, and the connectivity check rejects topologies without replica-set metadata.
- Redis is not required by this decision. Managed Redis may be added later only if measured worker requirements justify it and a new ADR is accepted.
