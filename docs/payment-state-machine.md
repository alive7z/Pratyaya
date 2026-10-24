# Payment state machine

M03 implements payment persistence, an explicit transition allowlist, versioned conditional updates, cancellation, and an append-only payment event timeline. M04 adds trusted capture/refund fixture transitions. Provider authorization and public capture/refund execution remain M05 work.

```text
CREATED -> AUTHORIZING -> AUTHORIZED -> CAPTURING -> CAPTURED
   |           |             |              |             |
   v           v             v              v             v
CANCELLED    FAILED        FAILED        UNKNOWN      REFUND_PENDING
                                              |             |
                                      reconciliation   PARTIALLY_REFUNDED
                                                            |
                                                         REFUNDED
```

Provider operations have their own states: `PENDING`, `IN_FLIGHT`, `SUCCEEDED`, `FAILED`, `UNKNOWN`, and `MANUAL_REVIEW`. Reconciliation status is independent. A transport timeout yields `UNKNOWN`; reconciliation uses the same persisted provider operation ID.

State services match merchant ID, payment ID, expected state, and version in one conditional update inside a MongoDB transaction. A zero-document match becomes an illegal-transition or concurrency error, never a blind overwrite. Cancellation uses the same pattern and writes its own idempotency record and timeline event.
