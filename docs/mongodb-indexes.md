# MongoDB indexes

Mongoose declares the following M04 correctness and query indexes. Atlas index creation is enabled only when `MONGODB_AUTO_INDEX=true`; production deployments should apply reviewed indexes before setting it to `false`.

| Collection              | Index                                                  | Purpose                               |
| ----------------------- | ------------------------------------------------------ | ------------------------------------- |
| `ledgeraccounts`        | unique `(merchantId, accountCode, currency)`           | Prevent conflicting chart definitions |
| `ledgeraccounts`        | `(merchantId, currency, status)`                       | Scoped account lists                  |
| `journals`              | unique `journalReference`                              | Globally unique accounting reference  |
| `journals`              | unique `(merchantId, sourceType, sourceId, eventType)` | Idempotent financial effect           |
| `journals`              | `(merchantId, currency, postedAt desc, _id desc)`      | Recent journal queries                |
| `journals`              | `(merchantId, entries.accountId, postedAt desc)`       | Account-entry projection              |
| `journals`              | `(merchantId, reversalOfJournalId, postedAt)`          | Reversal/refund investigation         |
| `ledgerevents`          | unique `eventId`; `(merchantId, createdAt desc)`       | Immutable event audit                 |
| `integrityreports`      | `(merchantId, executedAt desc)`                        | Report history                        |
| `reconciliationrecords` | `(merchantId, status, createdAt desc, _id desc)`       | Scoped work queue                     |
| `reconciliationrecords` | unique partial `(merchantId, providerReference)`       | Provider observation replay safety    |
| `outboxevents`          | `(state, availableAt, leaseUntil)`                     | Recoverable dispatcher leasing        |

All normal ledger reads begin with `merchantId`. Journal lists are paginated and bounded to 100 records. Balance aggregation uses indexed merchant/currency filtering, unwinds embedded entries, and returns string amounts. There is no balance snapshot in M04, so journals remain the only accounting source of truth.
