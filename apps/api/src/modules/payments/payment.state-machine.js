import { PAYMENT_STATUS } from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";

const TRANSITIONS = Object.freeze({
  [PAYMENT_STATUS.CREATED]: Object.freeze([
    PAYMENT_STATUS.QUEUED,
    PAYMENT_STATUS.CANCELLED,
  ]),
  [PAYMENT_STATUS.QUEUED]: Object.freeze([
    PAYMENT_STATUS.AUTHORIZING,
    PAYMENT_STATUS.CANCELLED,
    PAYMENT_STATUS.FAILED,
  ]),
  [PAYMENT_STATUS.AUTHORIZING]: Object.freeze([
    PAYMENT_STATUS.AUTHORIZED,
    PAYMENT_STATUS.FAILED,
    PAYMENT_STATUS.UNKNOWN,
  ]),
  [PAYMENT_STATUS.UNKNOWN]: Object.freeze([
    PAYMENT_STATUS.AUTHORIZING,
    PAYMENT_STATUS.AUTHORIZED,
    PAYMENT_STATUS.FAILED,
  ]),
  [PAYMENT_STATUS.AUTHORIZED]: Object.freeze([
    PAYMENT_STATUS.CAPTURING,
    PAYMENT_STATUS.CANCELLED,
    PAYMENT_STATUS.FAILED,
  ]),
  [PAYMENT_STATUS.CAPTURING]: Object.freeze([
    PAYMENT_STATUS.CAPTURED,
    PAYMENT_STATUS.FAILED,
    PAYMENT_STATUS.UNKNOWN,
  ]),
  [PAYMENT_STATUS.CAPTURED]: Object.freeze([PAYMENT_STATUS.REFUND_PENDING]),
  [PAYMENT_STATUS.REFUND_PENDING]: Object.freeze([
    PAYMENT_STATUS.PARTIALLY_REFUNDED,
    PAYMENT_STATUS.REFUNDED,
    PAYMENT_STATUS.FAILED,
  ]),
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: Object.freeze([
    PAYMENT_STATUS.REFUND_PENDING,
    PAYMENT_STATUS.REFUNDED,
  ]),
  [PAYMENT_STATUS.FAILED]: Object.freeze([]),
  [PAYMENT_STATUS.CANCELLED]: Object.freeze([]),
  [PAYMENT_STATUS.REFUNDED]: Object.freeze([]),
});

export const CANCELLABLE_STATUSES = Object.freeze([
  PAYMENT_STATUS.CREATED,
  PAYMENT_STATUS.QUEUED,
]);

export function canTransition(fromStatus, toStatus) {
  return (TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

export function assertTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    throw new AppError(
      409,
      "INVALID_PAYMENT_TRANSITION",
      `Payment cannot transition from ${fromStatus} to ${toStatus}`,
      { fromStatus, toStatus },
    );
  }
}

export function nextStatuses(fromStatus) {
  return TRANSITIONS[fromStatus] ?? [];
}
