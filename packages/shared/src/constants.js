export const SUPPORTED_CURRENCIES = Object.freeze(["USD", "INR"]);

// Both supported currencies have two decimal minor units. Keep this explicit so
// new currencies must be added deliberately rather than inferred at runtime.
export const CURRENCY_EXPONENT = Object.freeze({
  USD: 2,
  INR: 2,
});

export const ROLES = Object.freeze({
  MERCHANT: "MERCHANT",
  ADMIN: "ADMIN",
  DEVELOPER: "DEVELOPER",
  RISK_ANALYST: "RISK_ANALYST",
  AUDITOR: "AUDITOR",
});

export const DEMO_ROLES = Object.freeze([
  ROLES.MERCHANT,
  ROLES.ADMIN,
  ROLES.DEVELOPER,
  ROLES.RISK_ANALYST,
]);

export const DEMO_ROLE_LABELS = Object.freeze({
  MERCHANT: "Merchant",
  ADMIN: "Admin",
  DEVELOPER: "Developer",
  RISK_ANALYST: "Risk Analyst",
});

export const PERMISSIONS = Object.freeze({
  MERCHANT_DASHBOARD_READ: "merchant.dashboard.read",
  PAYMENTS_READ: "payments.read",
  PAYMENTS_CREATE: "payments.create",
  PAYMENTS_CANCEL: "payments.cancel",
  REFUNDS_READ: "refunds.read",
  ADMIN_DASHBOARD_READ: "admin.dashboard.read",
  MERCHANTS_READ: "merchants.read",
  AUDIT_READ: "audit.read",
  AUDIT_READ_OWN: "audit.read.own",
  DEVELOPER_DASHBOARD_READ: "developer.dashboard.read",
  WEBHOOKS_READ: "webhooks.read",
  API_LOGS_READ: "api.logs.read",
  RISK_DASHBOARD_READ: "risk.dashboard.read",
  RISK_ALERTS_READ: "risk.alerts.read",
  SYSTEM_HEALTH_READ: "system.health.read",
  LEDGER_READ: "ledger.read",
  LEDGER_INTEGRITY_RUN: "ledger.integrity.run",
  RECONCILIATION_READ: "reconciliation.read",
});

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.MERCHANT]: Object.freeze([
    PERMISSIONS.MERCHANT_DASHBOARD_READ,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_CANCEL,
    PERMISSIONS.REFUNDS_READ,
    PERMISSIONS.AUDIT_READ_OWN,
    PERMISSIONS.LEDGER_READ,
    PERMISSIONS.RECONCILIATION_READ,
  ]),
  [ROLES.ADMIN]: Object.freeze([
    PERMISSIONS.ADMIN_DASHBOARD_READ,
    PERMISSIONS.MERCHANTS_READ,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.SYSTEM_HEALTH_READ,
    PERMISSIONS.LEDGER_READ,
    PERMISSIONS.LEDGER_INTEGRITY_RUN,
    PERMISSIONS.RECONCILIATION_READ,
  ]),
  [ROLES.DEVELOPER]: Object.freeze([
    PERMISSIONS.DEVELOPER_DASHBOARD_READ,
    PERMISSIONS.WEBHOOKS_READ,
    PERMISSIONS.API_LOGS_READ,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.LEDGER_READ,
    PERMISSIONS.RECONCILIATION_READ,
  ]),
  [ROLES.RISK_ANALYST]: Object.freeze([
    PERMISSIONS.RISK_DASHBOARD_READ,
    PERMISSIONS.RISK_ALERTS_READ,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.AUDIT_READ_OWN,
    PERMISSIONS.LEDGER_READ,
    PERMISSIONS.RECONCILIATION_READ,
  ]),
  [ROLES.AUDITOR]: Object.freeze([
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.SYSTEM_HEALTH_READ,
    PERMISSIONS.LEDGER_READ,
    PERMISSIONS.LEDGER_INTEGRITY_RUN,
    PERMISSIONS.RECONCILIATION_READ,
  ]),
});

export function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function isDemoRole(role) {
  return DEMO_ROLES.includes(role);
}

export const AUTH_COOKIE_NAMES = Object.freeze({
  ACCESS: "pratyaya_access",
  REFRESH: "pratyaya_refresh",
  CSRF: "pratyaya_csrf",
});

export const CSRF_HEADER = "X-CSRF-Token";

export const ROLE_HOME_PATHS = Object.freeze({
  MERCHANT: "/app/merchant",
  ADMIN: "/app/admin",
  DEVELOPER: "/app/developer",
  RISK_ANALYST: "/app/risk",
  AUDITOR: "/app/audit",
});

export function roleHomePath(role) {
  return ROLE_HOME_PATHS[role] ?? "/app";
}

export const PAYMENT_STATUS = Object.freeze({
  CREATED: "CREATED",
  QUEUED: "QUEUED",
  AUTHORIZING: "AUTHORIZING",
  AUTHORIZED: "AUTHORIZED",
  CAPTURING: "CAPTURING",
  CAPTURED: "CAPTURED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  UNKNOWN: "UNKNOWN",
  REFUND_PENDING: "REFUND_PENDING",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  REFUNDED: "REFUNDED",
});

export const OPERATION_TYPES = Object.freeze({
  AUTHORIZE: "AUTHORIZE",
  CAPTURE: "CAPTURE",
  REFUND: "REFUND",
});

export const OPERATION_STATES = Object.freeze({
  PENDING: "PENDING",
  IN_FLIGHT: "IN_FLIGHT",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  UNKNOWN: "UNKNOWN",
  MANUAL_REVIEW: "MANUAL_REVIEW",
});

export const RECONCILIATION_STATUS = Object.freeze({
  NONE: "NONE",
  REQUIRED: "REQUIRED",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  MANUAL_REVIEW: "MANUAL_REVIEW",
});

export const RECONCILIATION_CASE_STATUS = Object.freeze({
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  MANUAL_REVIEW: "MANUAL_REVIEW",
});

export const IDEMPOTENCY_STATE = Object.freeze({
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
});

export const OUTBOX_STATE = Object.freeze({
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  DISPATCHED: "DISPATCHED",
  FAILED: "FAILED",
});

export const LEDGER_SIDES = Object.freeze({
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
});

export const LEDGER_ACCOUNT_TYPES = Object.freeze({
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
  REVENUE: "REVENUE",
  EXPENSE: "EXPENSE",
});

export const LEDGER_ACCOUNT_CODES = Object.freeze({
  PROVIDER_CLEARING: "PROVIDER_CLEARING",
  CASH_SETTLEMENT: "CASH_SETTLEMENT",
  MERCHANT_PAYABLE: "MERCHANT_PAYABLE",
  PROCESSING_FEE_REVENUE: "PROCESSING_FEE_REVENUE",
  REFUND_EXPENSE: "REFUND_EXPENSE",
});

export const LEDGER_NORMAL_BALANCES = Object.freeze({
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
});

export const LEDGER_EVENT_TYPES = Object.freeze({
  CAPTURE: "CAPTURE",
  REFUND: "REFUND",
  REVERSAL: "REVERSAL",
});

export const QUEUE_NAMES = Object.freeze({
  PAYMENT_OPERATIONS: "payment-operations",
  RECONCILIATION: "reconciliation",
  WEBHOOK_PROCESSING: "webhook-processing",
});

export const IDEMPOTENCY_OPERATIONS = Object.freeze({
  CREATE_PAYMENT: "payments.create",
  AUTHORIZE_PAYMENT: "payments.authorize",
  CAPTURE_PAYMENT: "payments.capture",
  REFUND_PAYMENT: "payments.refund",
  CANCEL_PAYMENT: "payments.cancel",
  EXECUTE_AGENT_PROPOSAL: "agentpay.execute",
});

export const OUTBOX_EVENT_TYPES = Object.freeze({
  PAYMENT_CREATED: "payment.created",
  PAYMENT_CANCELLED: "payment.cancelled",
  PAYMENT_AUTHORIZE_REQUESTED: "payment.authorize.requested",
  PAYMENT_CAPTURE_REQUESTED: "payment.capture.requested",
  PAYMENT_REFUND_REQUESTED: "payment.refund.requested",
  PAYMENT_RECONCILIATION_REQUESTED: "payment.reconciliation.requested",
  LEDGER_JOURNAL_POSTED: "ledger.journal.posted",
  LEDGER_INTEGRITY_COMPLETED: "ledger.integrity.completed",
});
