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

function getApiOrigin() {
  const configured = process.env.PRATYAYA_API_ORIGIN;

  if (!configured) {
    throw new Error("PRATYAYA_API_ORIGIN is not configured");
  }

  const url = new URL(configured);

  if (
    !["https:", "http:"].includes(url.protocol) ||
    (url.protocol === "http:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid PRATYAYA_API_ORIGIN configuration");
  }

  return url.origin;
}

function getRequestHeaders(req) {
  const headers = new Headers();
  const excluded = new Set(HOP_BY_HOP_HEADERS);

  const connection = req.headers?.connection;

  if (connection) {
    for (const name of String(connection).split(",")) {
      excluded.add(name.trim().toLowerCase());
    }
  }

  for (const [name, value] of Object.entries(req.headers ?? {})) {
    if (
      excluded.has(name.toLowerCase()) ||
      value === undefined ||
      value === null
    ) {
      continue;
    }

    headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
  }

  return headers;
}

function getRequestBody(req) {
  if (["GET", "HEAD"].includes(req.method)) {
    return undefined;
  }

  if (req.body === undefined || req.body === null) {
    return undefined;
  }

  if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
    return req.body;
  }

  if (typeof req.body === "object") {
    return JSON.stringify(req.body);
  }

  return String(req.body);
}

function setResponseHeaders(upstream, res) {
  const excluded = new Set(HOP_BY_HOP_HEADERS);

  const connection = upstream.headers.get("connection");

  if (connection) {
    for (const name of connection.split(",")) {
      excluded.add(name.trim().toLowerCase());
    }
  }

  for (const [name, value] of upstream.headers.entries()) {
    if (
      excluded.has(name.toLowerCase()) ||
      name.toLowerCase() === "set-cookie" ||
      name.toLowerCase() === "content-encoding"
    ) {
      continue;
    }
    res.setHeader(name, value);
  }

  const cookies = upstream.headers.getSetCookie?.() ?? [];

  if (cookies.length > 0) {
    res.setHeader("Set-Cookie", cookies);
  }
}

export default async function handler(req, res) {
  try {
    const origin = getApiOrigin();
    const incoming = new URL(req.url, "http://localhost");

    // Read the original API path supplied by the Vercel rewrite.
    const forwardedPath = incoming.searchParams.get("path");

    // Validate the path before forwarding the request.
    if (
      !forwardedPath ||
      forwardedPath.startsWith("/") ||
      forwardedPath.includes("\\") ||
      forwardedPath
        .split("/")
        .some((segment) => !segment || segment === "." || segment === "..")
    ) {
      return res.status(400).json({
        error: "Invalid API path",
      });
    }

    // Preserve the original query parameters, excluding the
    // internal "path" parameter used by the Vercel rewrite.
    const forwardedQuery = new URLSearchParams(incoming.searchParams);
    forwardedQuery.delete("path");

    const queryString = forwardedQuery.toString();

    // Reconstruct the actual Render API endpoint.
    const target = new URL(origin);

    target.pathname = `/api/v1/${forwardedPath}`;
    target.search = queryString ? `?${queryString}` : "";

    if (target.origin !== origin) {
      throw new Error("Invalid upstream destination");
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers: getRequestHeaders(req),
      body: getRequestBody(req),
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });

    setResponseHeaders(upstream, res);

    res.status(upstream.status);

    if (
      req.method === "HEAD" ||
      upstream.status === 204 ||
      upstream.status === 304
    ) {
      return res.end();
    }

    const body = Buffer.from(await upstream.arrayBuffer());

    return res.send(body);
  } catch (error) {
    console.error("Pratyaya API proxy error:", error.message);

    if (res.headersSent) {
      return res.end();
    }

    return res.status(502).json({
      error: {
        code: "API_PROXY_UNAVAILABLE",
        message: "The Pratyaya API is unavailable",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}
