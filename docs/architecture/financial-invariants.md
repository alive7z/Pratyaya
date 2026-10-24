# Financial invariants

| Invariant                        | Enforcement                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Debits equal credits             | Domain validation totals `BigInt` entries before persistence; Guardian rescans stored journals.                                                       |
| Valid money                      | Shared parser accepts positive integer decimal strings within the configured minor-unit bound. JSON never carries financial floats.                   |
| Merchant isolation               | Auth supplies the merchant scope; account lookup and every read query include it; foreign accounts are rejected.                                      |
| Currency consistency             | Journal currency is allowlisted and every referenced account must have the same currency. Aggregations remain currency-specific.                      |
| One accounting effect per source | Unique compound source-event index plus deterministic references and idempotent replay handling. This is not a claim of global exactly-once delivery. |
| Immutable history                | Entries are embedded in a posted journal; supported update/delete operations fail. Corrections are new linked journals.                               |
| Payment/ledger consistency       | Only trusted confirmed capture/refund services post. CREATED, QUEUED, AUTHORIZED, FAILED, and CANCELLED states do not represent captured funds.       |
| Atomicity                        | Payment, journal, audit event, and outbox writes share one Atlas multi-document transaction. Injected-failure tests prove rollback.                   |
| Refund limit                     | Conditional payment version/refunded-amount transition and transaction conflict handling prevent cumulative over-refund.                              |
| Auditability                     | Journal source, event type, actor, request ID, ledger event, payment metadata, and outbox record reconstruct origin without secrets.                  |

Validation has layers: Zod rejects malformed HTTP inputs; domain code enforces accounting meaning; MongoDB indexes arbitrate concurrent uniqueness; transactions guarantee all-or-nothing persistence; the Guardian detects corruption or drift after the fact. No one layer substitutes for another.

On transaction failure, MongoDB aborts all local writes. Transient errors may be retried by the driver because the source identity is stable. An uncertain commit is resolved by reading that identity. An `UNKNOWN` provider outcome is not confirmation and must reconcile using the original provider operation ID before financial posting.
