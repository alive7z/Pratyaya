const roles = ["MERCHANT", "ADMIN", "DEVELOPER", "RISK_ANALYST"];
const dashboardByRole = {
  MERCHANT: "/dashboard/merchant",
  ADMIN: "/dashboard/admin",
  DEVELOPER: "/dashboard/developer",
  RISK_ANALYST: "/dashboard/risk",
};

function requiredUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) {
    throw new Error(`${name} must use HTTPS for a deployed smoke test`);
  }
  return url.origin;
}

function cookieJar() {
  const values = new Map();
  return {
    capture(headers) {
      for (const value of headers.getSetCookie?.() ?? []) {
        const pair = value.split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator > 0) {
          values.set(pair.slice(0, separator), pair.slice(separator + 1));
        }
      }
    },
    header() {
      return [...values].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    get(name) {
      return values.get(name);
    },
  };
}

async function jsonRequest(url, options = {}, jar) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(jar?.header() ? { Cookie: jar.header() } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  jar?.capture(response.headers);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${url} returned ${response.status} (${body?.error?.code ?? "non-JSON error"})`,
    );
  }
  return { response, body };
}

const webOrigin = requiredUrl("PRATYAYA_WEB_URL");
const apiOrigin = requiredUrl("PRATYAYA_API_URL");
const apiBase = `${apiOrigin}/api/v1`;
const results = [];

const web = await fetch(`${webOrigin}/login`, {
  signal: AbortSignal.timeout(30_000),
});
if (!web.ok || !web.headers.get("content-type")?.includes("text/html")) {
  throw new Error(`Frontend smoke check failed with ${web.status}`);
}
results.push({ check: "frontend", status: web.status });

for (const path of ["/health/live", "/health/ready", "/demo/roles"]) {
  const { response } = await jsonRequest(`${apiBase}${path}`);
  results.push({ check: path, status: response.status });
}

for (const role of roles) {
  const jar = cookieJar();
  const { body: session } = await jsonRequest(
    `${apiBase}/demo/session`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    },
    jar,
  );
  if (
    session?.data?.membership?.role !== role ||
    !session?.data?.user?.isDemo
  ) {
    throw new Error(`${role} demo session returned the wrong identity`);
  }

  const { body: identity } = await jsonRequest(`${apiBase}/auth/me`, {}, jar);
  if (identity?.data?.membership?.role !== role) {
    throw new Error(`${role} /auth/me verification failed`);
  }

  await jsonRequest(`${apiBase}${dashboardByRole[role]}`, {}, jar);

  const csrf = jar.get("pratyaya_csrf");
  await jsonRequest(
    `${apiBase}/auth/logout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": decodeURIComponent(csrf ?? ""),
      },
      body: "{}",
    },
    jar,
  );
  results.push({ check: `explore:${role}`, status: "passed" });
}

for (const [name, value] of [
  ["provider", process.env.PRATYAYA_PROVIDER_URL],
  ["worker", process.env.PRATYAYA_WORKER_URL],
]) {
  if (!value) continue;
  const origin = new URL(value).origin;
  const { response } = await jsonRequest(`${origin}/health/ready`);
  results.push({ check: `${name}:ready`, status: response.status });
}

console.log(JSON.stringify({ status: "passed", results }, null, 2));
