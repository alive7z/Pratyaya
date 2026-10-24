import { AUTH_COOKIE_NAMES, permissionsForRole } from "@pratyaya/shared";
import { AppError } from "../lib/errors.js";
import { parseCookies } from "../lib/cookies.js";
import { InvalidTokenError, verifyAccessToken } from "../lib/tokens.js";
import { User, Session } from "../modules/auth/auth.model.js";
import { Merchant, Membership } from "../modules/merchants/merchant.model.js";

function unauthorized(message = "Authentication is required") {
  return new AppError(401, "UNAUTHENTICATED", message);
}

export function authenticate({ config }) {
  return async function authenticateRequest(req, _res, next) {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const authorization = req.get("Authorization");
      const bearer = authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : null;
      const token = bearer || cookies[AUTH_COOKIE_NAMES.ACCESS];

      if (!token) {
        throw unauthorized();
      }

      let payload;
      try {
        payload = verifyAccessToken(token, {
          secret: config.auth.jwtSecret,
          issuer: config.auth.issuer,
          audience: config.auth.audience,
        });
      } catch (error) {
        if (error instanceof InvalidTokenError) {
          throw unauthorized("Access token is invalid or expired");
        }
        throw error;
      }

      const [session, user] = await Promise.all([
        Session.findById(payload.sid),
        User.findById(payload.sub),
      ]);

      const now = Date.now();
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() <= now ||
        (session.demoExpiresAt && session.demoExpiresAt.getTime() <= now) ||
        !user ||
        user.status !== "ACTIVE"
      ) {
        throw unauthorized("Session is invalid or expired");
      }

      if (
        String(session.userId) !== String(user._id) ||
        String(session.merchantId) !== payload.mid ||
        session.role !== payload.role
      ) {
        throw unauthorized("Session context is invalid");
      }

      const [membership, merchant] = await Promise.all([
        Membership.findOne({
          userId: user._id,
          merchantId: session.merchantId,
          role: session.role,
          status: "ACTIVE",
        }).lean(),
        Merchant.findById(session.merchantId).lean(),
      ]);

      if (
        !membership ||
        !merchant ||
        merchant.status !== "ACTIVE" ||
        membership.role !== session.role
      ) {
        throw unauthorized("Membership is no longer active");
      }

      const isDemo = Boolean(session.isDemo || user.isDemo || merchant.isDemo);
      if (isDemo && (!user.isDemo || !merchant.isDemo || !session.isDemo)) {
        throw unauthorized("Demo session scope is invalid");
      }

      req.auth = {
        user,
        session,
        membership,
        merchant,
        role: membership.role,
        merchantId: merchant._id,
        isDemo,
        permissions: permissionsForRole(membership.role),
        accessToken: token,
        accessExpiresAt: new Date(payload.exp * 1000),
        csrfToken: cookies[AUTH_COOKIE_NAMES.CSRF],
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
