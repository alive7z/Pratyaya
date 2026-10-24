import { timingSafeEqual } from "node:crypto";
import { AUTH_COOKIE_NAMES, CSRF_HEADER } from "@pratyaya/shared";
import { AppError } from "../lib/errors.js";
import { parseCookies } from "../lib/cookies.js";

export function requireCsrf(req, _res, next) {
  if (req.get("Authorization")?.startsWith("Bearer ")) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[AUTH_COOKIE_NAMES.CSRF];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return next(
      new AppError(
        403,
        "CSRF_VALIDATION_FAILED",
        "A valid CSRF token is required for this request",
      ),
    );
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (
    cookieBuffer.length !== headerBuffer.length ||
    !timingSafeEqual(cookieBuffer, headerBuffer)
  ) {
    return next(
      new AppError(
        403,
        "CSRF_VALIDATION_FAILED",
        "A valid CSRF token is required for this request",
      ),
    );
  }

  return next();
}
