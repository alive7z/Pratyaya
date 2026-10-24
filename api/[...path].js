const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function apiOrigin() {
  const configured = process.env.PRATYAYA_API_ORIGIN;
  if (!configured) {
    throw new Error("PRATYAYA_API_ORIGIN is not configured");
  }

  const origin = new URL(configured);
  if (origin.protocol !== "https:" || origin.username || origin.password) {
    throw new Error("PRATYAYA_API_ORIGIN must be a credential-free HTTPS URL");
  }

  return origin.origin;
}

function requestBody(req) {
  if (["GET", "HEAD"].includes(req.method)) return undefined;
  if (req.body === undefined || req.body === null) return undefined;
  if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
    return req.body;
  }
  return JSON.stringify(req.body);
}

function requestHeaders(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase()) || value === undefined) {
      continue;
    }
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

function copyResponseHeaders(upstream, res) {
  for (const [name, value] of upstream.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase()) || name === "set-cookie") {
      continue;
    }
    res.setHeader(name, value);
  }

  const cookies = upstream.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
}

export default async function handler(req, res) {
  try {
    const incoming = new URL(req.url, "https://pratyaya.invalid");
    const upstream = await fetch(
      `${apiOrigin()}${incoming.pathname}${incoming.search}`,
      {
        method: req.method,
        headers: requestHeaders(req),
        body: requestBody(req),
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      },
    );

    copyResponseHeaders(upstream, res);
    res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).json({
      error: {
        code: "API_PROXY_UNAVAILABLE",
        message: "The Pratyaya API is unavailable",
      },
      meta: { timestamp: new Date().toISOString() },
    });
  }
}
