# Reconciliation and integrity monitoring

Pratyaya has two separate diagnostic paths. Reconciliation compares a payment with its persisted provider-operation evidence; the Integrity Guardian checks consistency among internal payment, account, and journal records. Neither path edits posted journals or automatically applies a financial correction.

## Current reconciliation behavior

The reconciliation checker reads the payment, core provider-operation record, and journal state from MongoDB. It creates merchant-scoped `ReconciliationRecord` data and discrepancy cases for missing or mismatched evidence. This is a comparison against the provider operation snapshot already persisted by the mock-provider workflow; it does **not** make a live request to an external provider or independently fetch provider settlement data.

Supported outcomes include `MATCHED`, `MISSING_INTERNAL_RECORD`, `MISSING_PROVIDER_RECORD`, `AMOUNT_MISMATCH`, `STATUS_MISMATCH`, `PENDING_REVIEW`, and `RESOLVED`. Stored details include payment/provider references, statuses, expected and observed minor-unit amounts, currency, attempts, check time, and resolution metadata.

Reconciliation is diagnostic. A mismatch requires investigation and a separately authorized domain action. The checker does not rewrite a payment, post a journal, or manufacture provider evidence. Resolve current operational discrepancies through the documented review API and retain the original operation identity.

## Integrity Guardian

Integrity scans internal records and reports violations such as unbalanced journals or inconsistent payment/accounting evidence. Its reports are evidence for operators, not automatic repair instructions. Any correction to a confirmed financial event must use a new compensating entry under the ledger rules.

## Operational boundary

Both flows are synthetic and merchant-scoped. Their APIs require the applicable read or integrity permission. Indexes support bounded merchant queries and replay protection; see [MongoDB indexes](../mongodb-indexes.md) and [ledger invariants](financial-invariants.md). External provider reconciliation and settlement-file ingestion remain out of scope.
