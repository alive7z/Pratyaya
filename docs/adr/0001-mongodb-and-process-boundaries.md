# ADR 0001: MongoDB and process boundaries

Status: accepted for Milestone 01; database hosting superseded by ADR 0002

## Decision

Use MongoDB through Mongoose as Pratyaya's authoritative database. Use MongoDB Atlas replica sets for transaction tests and hosted environments. Use a separate Atlas database/cluster for the mock provider. Begin durable asynchronous processing with transactional outbox documents and atomic MongoDB leases; do not introduce Redis initially.

Keep one modular-monolith codebase with separately runnable API, worker, provider, and web processes.

## Consequences

Financial services must pass sessions through every participating repository operation. Cross-document constraints such as balanced journals remain service invariants validated before commit. Unique compound indexes and conditional updates are essential for concurrency. Atlas credentials must remain environment-only, and local development requires Atlas connectivity instead of a local Docker MongoDB. Redis can be reconsidered only after observed throughput or latency needs justify the added infrastructure.
