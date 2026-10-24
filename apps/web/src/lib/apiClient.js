export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
export const API_DOCS_URL = import.meta.env.VITE_API_DOCS_URL || "/api-docs";

export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

function csrfToken() {
  if (typeof document === "undefined") return null;
  const row = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("pratyaya_csrf="));
  return row ? decodeURIComponent(row.slice("pratyaya_csrf=".length)) : null;
}

export async function request(
  path,
  { acceptedStatuses = [], headers, ...options } = {},
) {
  const requestId =
    globalThis.crypto?.randomUUID?.() ??
    `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      "X-Request-ID": requestId,
      ...headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    throw new ApiError({
      status: response.status,
      code: body?.error?.code ?? "REQUEST_FAILED",
      message:
        body?.error?.message ?? `Request failed with status ${response.status}`,
      details: body?.error?.details,
      requestId: response.headers.get("X-Request-ID") ?? requestId,
    });
  }

  return body;
}

export const healthApi = {
  getLiveness() {
    return request("/health/live");
  },
  getReadiness() {
    return request("/health/ready", { acceptedStatuses: [503] });
  },
};

function jsonOptions(method, body, { csrf = false } = {}) {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(csrf && csrfToken() ? { "X-CSRF-Token": csrfToken() } : {}),
    },
    body: JSON.stringify(body),
  };
}

export const authApi = {
  me: () => request("/auth/me"),
  login: (body) => request("/auth/login", jsonOptions("POST", body)),
  register: (body) => request("/auth/register", jsonOptions("POST", body)),
  demo: (role) => request("/demo/session", jsonOptions("POST", { role })),
};

function queryString(values) {
  const params = new URLSearchParams(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const ledgerApi = {
  accounts: (query = {}) => request(`/ledger/accounts${queryString(query)}`),
  account: (id) => request(`/ledger/accounts/${id}`),
  accountEntries: (id, query = {}) =>
    request(`/ledger/accounts/${id}/entries${queryString(query)}`),
  journals: (query = {}) => request(`/ledger/journals${queryString(query)}`),
  journal: (id) => request(`/ledger/journals/${id}`),
  balances: (currency) =>
    request(`/ledger/balances${queryString({ currency })}`),
  trialBalance: (currency) =>
    request(`/ledger/trial-balance${queryString({ currency })}`),
  integrityReports: (query = {}) =>
    request(`/ledger/integrity/reports${queryString(query)}`),
  integrityReport: (id) => request(`/ledger/integrity/reports/${id}`),
  runIntegrity: (currency) =>
    request(
      "/ledger/integrity/check",
      jsonOptions("POST", { currency }, { csrf: true }),
    ),
  reconciliation: (query = {}) =>
    request(`/reconciliation${queryString(query)}`),
};

export const paymentsApi = {
  list: (query = {}) => request(`/payments${queryString(query)}`),
  summary: () => request("/payments/summary"),
  get: (id) => request(`/payments/${id}`),
  timeline: (id) => request(`/payments/${id}/timeline`),
  attempts: (id) => request(`/payments/${id}/attempts`),
  capture: (id, body, idempotencyKey) =>
    request(
      `/payments/${id}/capture`,
      jsonOptions("POST", body, { csrf: true }),
      { headers: { "Idempotency-Key": idempotencyKey } },
    ),
  cancel: (id, body, idempotencyKey) =>
    request(
      `/payments/${id}/cancel`,
      jsonOptions("POST", body, { csrf: true }),
      { headers: { "Idempotency-Key": idempotencyKey } },
    ),
  refunds: (id, query = {}) =>
    request(`/payments/${id}/refunds${queryString(query)}`),
  createRefund: (id, body, idempotencyKey) =>
    request(
      `/payments/${id}/refunds`,
      jsonOptions("POST", body, { csrf: true }),
      { headers: { "Idempotency-Key": idempotencyKey } },
    ),
  getRefund: (id) => request(`/refunds/${id}`),
  processRefund: (id) =>
    request(`/refunds/${id}/process`, jsonOptions("POST", {}, { csrf: true })),
  confirmRefund: (id, body) =>
    request(
      `/refunds/${id}/confirm`,
      jsonOptions("POST", body, { csrf: true }),
    ),
  failRefund: (id, body) =>
    request(`/refunds/${id}/fail`, jsonOptions("POST", body, { csrf: true })),
};

export const webhooksApi = {
  provider: (body) => request("/webhooks/provider", jsonOptions("POST", body)),
  listInbox: (query = {}) => request(`/webhooks/inbox${queryString(query)}`),
  retryInbox: (id) =>
    request(`/webhooks/inbox/${id}/retry`, jsonOptions("POST", {})),
};

export const providerApi = {
  health: () => request("/providers/health"),
  operations: (query = {}) =>
    request(`/sandbox/provider-operations${queryString(query)}`),
};

export const reconciliationApi = {
  list: (query = {}) => request(`/reconciliation${queryString(query)}`),
  summary: () => request("/reconciliation/summary"),
  checkPayment: (id) =>
    request(`/reconciliation/${id}/check`, jsonOptions("POST", {})),
  getRecord: (id) => request(`/reconciliation/${id}`),
  listCases: (query = {}) =>
    request(`/reconciliation/cases${queryString(query)}`),
  getCase: (id) => request(`/reconciliation/cases/${id}`),
};

export const sandboxApi = {
  jobs: (query = {}) => request(`/sandbox/jobs${queryString(query)}`),
  webhooks: (query = {}) => request(`/sandbox/webhooks${queryString(query)}`),
  outbox: (query = {}) => request(`/sandbox/outbox${queryString(query)}`),
  faults: () => request("/sandbox/faults"),
  setFaults: (body) => request("/sandbox/faults", jsonOptions("POST", body)),
  clearFaults: () => request("/sandbox/faults", { method: "DELETE" }),
};

export const apiClient = {
  request,
  health: healthApi,
  auth: authApi,
  ledger: ledgerApi,
  payments: paymentsApi,
  webhooks: webhooksApi,
  provider: providerApi,
  reconciliation: reconciliationApi,
  sandbox: sandboxApi,
};
