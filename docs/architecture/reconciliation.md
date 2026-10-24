# Reconciliation foundation

`ReconciliationRecord` stores a merchant-scoped comparison between internal payment state and a provider observation: payment/reference, statuses, expected and observed minor units, currency, attempt count, last check time, and resolution metadata.

Supported states are `MATCHED`, `MISSING_INTERNAL_RECORD`, `MISSING_PROVIDER_RECORD`, `AMOUNT_MISMATCH`, `STATUS_MISMATCH`, `PENDING_REVIEW`, and `RESOLVED`.

M04 records are explicitly labeled trusted synthetic fixtures. The read API and React workspace do not claim live provider reconciliation. A discrepancy never edits a journal or automatically posts a correction. A later provider workflow must authenticate the observation, retain the original provider operation identity, and require an authorized domain action for any compensating entry.

The Integrity Guardian is related but separate: it scans internal payment/accounting consistency. Reconciliation compares internal state with external observations. Both are diagnostic and read-only with respect to posted accounting history.
