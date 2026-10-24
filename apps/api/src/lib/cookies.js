import { AUTH_COOKIE_NAMES } from "@pratyaya/shared";

const REFRESH_PATH = "/api/v1/auth";

export function parseCookies(header) {
  const cookies = {};

  if (typeof header !== "string" || header.length === 0) return cookies;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) continue;

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
}

function baseCookieOptions({ secure }) {
  return {
    secure,
    sameSite: "lax",
    domain: undefined,
  };
}

export function setAuthCookies(
  res,
  {
    accessToken,
    refreshToken,
    csrfToken,
    accessMaxAgeMs,
    refreshMaxAgeMs,
    secure,
  },
) {
  const base = baseCookieOptions({ secure });

  res.cookie(AUTH_COOKIE_NAMES.ACCESS, accessToken, {
    ...base,
    httpOnly: true,
    path: "/",
    maxAge: accessMaxAgeMs,
  });

  res.cookie(AUTH_COOKIE_NAMES.REFRESH, refreshToken, {
    ...base,
    httpOnly: true,
    sameSite: "strict",
    path: REFRESH_PATH,
    maxAge: refreshMaxAgeMs,
  });

  res.cookie(AUTH_COOKIE_NAMES.CSRF, csrfToken, {
    ...base,
    httpOnly: false,
    path: "/",
    maxAge: refreshMaxAgeMs,
  });
}

export function clearAuthCookies(res, { secure }) {
  const base = baseCookieOptions({ secure });

  res.clearCookie(AUTH_COOKIE_NAMES.ACCESS, {
    ...base,
    httpOnly: true,
    path: "/",
  });
  res.clearCookie(AUTH_COOKIE_NAMES.REFRESH, {
    ...base,
    httpOnly: true,
    sameSite: "strict",
    path: REFRESH_PATH,
  });
  res.clearCookie(AUTH_COOKIE_NAMES.CSRF, {
    ...base,
    httpOnly: false,
    path: "/",
  });
}
