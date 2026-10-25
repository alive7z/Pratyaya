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

  let cleanPath = path;
  if (!cleanPath.startsWith("http://") && !cleanPath.startsWith("https://")) {
    if (cleanPath.startsWith("/api/v1/")) {
      cleanPath = cleanPath.slice("/api/v1".length);
    } else if (cleanPath === "/api/v1") {
      cleanPath = "";
    }
    cleanPath = `${API_BASE_URL}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;
  }

  const response = await fetch(cleanPath, {
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
  logout: () =>
    request("/auth/logout", jsonOptions("POST", {}, { csrf: true })),
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

function idempotentJsonOptions(method, body, idempotencyKey) {
  const options = jsonOptions(method, body, { csrf: true });
  return {
    ...options,
    headers: {
      ...options.headers,
      "Idempotency-Key": idempotencyKey,
    },
  };
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
  create: (body, idempotencyKey) =>
    request("/payments", idempotentJsonOptions("POST", body, idempotencyKey)),
  summary: () => request("/payments/summary"),
  get: (id) => request(`/payments/${id}`),
  timeline: (id) => request(`/payments/${id}/timeline`),
  attempts: (id) => request(`/payments/${id}/attempts`),
  capture: (id, body, idempotencyKey) =>
    request(
      `/payments/${id}/capture`,
      idempotentJsonOptions("POST", body, idempotencyKey),
    ),
  cancel: (id, body, idempotencyKey) =>
    request(
      `/payments/${id}/cancel`,
      idempotentJsonOptions("POST", body, idempotencyKey),
    ),
  refunds: (id, query = {}) =>
    request(`/payments/${id}/refunds${queryString(query)}`),
  createRefund: (id, body, idempotencyKey) =>
    request(
      `/payments/${id}/refunds`,
      idempotentJsonOptions("POST", body, idempotencyKey),
    ),
  getRefund: (id) => request(`/payments/refunds/${id}`),
  processRefund: (id) =>
    request(
      `/payments/refunds/${id}/process`,
      jsonOptions("POST", {}, { csrf: true }),
    ),
  confirmRefund: (id, body) =>
    request(
      `/payments/refunds/${id}/confirm`,
      jsonOptions("POST", body, { csrf: true }),
    ),
  failRefund: (id, body) =>
    request(
      `/payments/refunds/${id}/fail`,
      jsonOptions("POST", body, { csrf: true }),
    ),
};

export const webhooksApi = {
  provider: (body) => request("/webhooks/provider", jsonOptions("POST", body)),
  listInbox: (query = {}) => request(`/webhooks/inbox${queryString(query)}`),
  retryInbox: (id) =>
    request(
      `/webhooks/inbox/${id}/retry`,
      jsonOptions("POST", {}, { csrf: true }),
    ),
};

export const providerApi = {
  health: () => request("/routing/providers"),
  operations: (query = {}) =>
    request(`/sandbox/provider-operations${queryString(query)}`),
};

export const reconciliationApi = {
  list: (query = {}) => request(`/reconciliation${queryString(query)}`),
  summary: () => request("/reconciliation/summary"),
  checkPayment: (id) =>
    request(
      `/reconciliation/${id}/check`,
      jsonOptions("POST", {}, { csrf: true }),
    ),
  getRecord: (id) => request(`/reconciliation/records/${id}`),
  listCases: (query = {}) =>
    request(`/reconciliation/cases${queryString(query)}`),
  getCase: (id) => request(`/reconciliation/cases/${id}`),
};

export const agentpayApi = {
  getPolicy: () => request("/agentpay/policy"),
  createPolicy: (body) =>
    request("/agentpay/policy", jsonOptions("POST", body, { csrf: true })),
  updatePolicy: (body) =>
    request("/agentpay/policy", jsonOptions("PUT", body, { csrf: true })),
  submitInvoice: (body) =>
    request("/agentpay/invoices", jsonOptions("POST", body, { csrf: true })),
  listInvoices: (query = {}) =>
    request(`/agentpay/invoices${queryString(query)}`),
  getInvoice: (id) => request(`/agentpay/invoices/${id}`),
  decideInvoice: (id, body) =>
    request(
      `/agentpay/invoices/${id}/decide`,
      jsonOptions("POST", body, { csrf: true }),
    ),
  executeInvoice: (id) =>
    request(
      `/agentpay/invoices/${id}/execute`,
      jsonOptions("POST", {}, { csrf: true }),
    ),
};

export const routingApi = {
  providers: () => request("/routing/providers"),
  provider: (id) => request(`/routing/providers/${id}`),
  providerHealth: (id) => request(`/routing/providers/${id}/health`),
  decisions: (query = {}) => request(`/routing/decisions${queryString(query)}`),
  decision: (id) => request(`/routing/decisions/${id}`),
  policies: () => request("/routing/policies"),
  updatePolicy: (id, body) =>
    request(
      `/routing/policies/${id}`,
      jsonOptions("PUT", body, { csrf: true }),
    ),
  circuitBreakers: () => request("/routing/circuit-breakers"),
  resetCircuitBreaker: (providerId) =>
    request(
      `/routing/circuit-breakers/${providerId}/reset`,
      jsonOptions("POST", {}, { csrf: true }),
    ),
  simulate: (body) =>
    request("/routing/simulate", jsonOptions("POST", body, { csrf: true })),
};

export const riskApi = {
  summary: () => request("/risk/summary"),
  rules: () => request("/risk/rules"),
  createRule: (body) =>
    request("/risk/rules", jsonOptions("POST", body, { csrf: true })),
  updateRule: (code, body) =>
    request(`/risk/rules/${code}`, jsonOptions("PUT", body, { csrf: true })),
  deleteRule: (code) =>
    request(`/risk/rules/${code}`, {
      method: "DELETE",
      headers: csrfToken() ? { "X-CSRF-Token": csrfToken() } : {},
    }),
  alerts: (query = {}) => request(`/risk/alerts${queryString(query)}`),
  decisions: (query = {}) => request(`/risk/decisions${queryString(query)}`),
};

export const sandboxApi = {
  jobs: (query = {}) => request(`/sandbox/jobs${queryString(query)}`),
  webhooks: (query = {}) => request(`/sandbox/webhooks${queryString(query)}`),
  outbox: (query = {}) => request(`/sandbox/outbox${queryString(query)}`),
  faults: () => request("/sandbox/faults"),
  setFaults: (body) =>
    request("/sandbox/faults", jsonOptions("POST", body, { csrf: true })),
  clearFaults: () =>
    request("/sandbox/faults", {
      method: "DELETE",
      headers: csrfToken() ? { "X-CSRF-Token": csrfToken() } : {},
    }),
};

export const apiClient = {
  request,
  get: (path, options = {}) => request(path, { method: "GET", ...options }),
  post: (path, body, options = {}) =>
    request(path, {
      method: "POST",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken() ? { "X-CSRF-Token": csrfToken() } : {}),
        ...options.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: (path, body, options = {}) =>
    request(path, {
      method: "PUT",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken() ? { "X-CSRF-Token": csrfToken() } : {}),
        ...options.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: (path, body, options = {}) =>
    request(path, {
      method: "PATCH",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken() ? { "X-CSRF-Token": csrfToken() } : {}),
        ...options.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: (path, options = {}) =>
    request(path, {
      method: "DELETE",
      ...options,
      headers: {
        ...(csrfToken() ? { "X-CSRF-Token": csrfToken() } : {}),
        ...options.headers,
      },
    }),
  health: healthApi,
  auth: authApi,
  ledger: ledgerApi,
  payments: paymentsApi,
  webhooks: webhooksApi,
  provider: providerApi,
  routing: routingApi,
  risk: riskApi,
  reconciliation: reconciliationApi,
  agentpay: agentpayApi,
  sandbox: sandboxApi,
};
