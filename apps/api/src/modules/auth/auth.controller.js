import { AUTH_COOKIE_NAMES } from "@pratyaya/shared";
import { sendData } from "../../lib/response.js";
import {
  parseCookies,
  setAuthCookies,
  clearAuthCookies,
} from "../../lib/cookies.js";
import {
  currentAuthPayload,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  serializeAuthResult,
} from "./auth.service.js";

export function applySessionCookies(res, config, result) {
  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    csrfToken: result.csrfToken,
    accessMaxAgeMs: config.auth.accessTokenTtlSeconds * 1000,
    refreshMaxAgeMs: result.refreshTokenTtlSeconds * 1000,
    secure: config.auth.secureCookies,
  });
}

export async function register(req, res, next) {
  try {
    const result = await registerUser({
      input: req.validated.body,
      req,
      config: req.app.locals.config,
    });
    applySessionCookies(res, req.app.locals.config, result);
    sendData(req, res, serializeAuthResult(result), 201);
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser({
      input: req.validated.body,
      req,
      config: req.app.locals.config,
    });
    applySessionCookies(res, req.app.locals.config, result);
    sendData(req, res, serializeAuthResult(result), 200);
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const result = await refreshSession({
      refreshToken: cookies[AUTH_COOKIE_NAMES.REFRESH],
      req,
      config: req.app.locals.config,
    });
    applySessionCookies(res, req.app.locals.config, result);
    sendData(req, res, serializeAuthResult(result), 200);
  } catch (error) {
    clearAuthCookies(res, {
      secure: req.app.locals.config.auth.secureCookies,
    });
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const result = await logoutSession({
      refreshToken: cookies[AUTH_COOKIE_NAMES.REFRESH],
      auth: req.auth,
      req,
      config: req.app.locals.config,
    });
    clearAuthCookies(res, {
      secure: req.app.locals.config.auth.secureCookies,
    });
    sendData(req, res, { loggedOut: true, ...result }, 200);
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    sendData(req, res, await currentAuthPayload(req.auth), 200);
  } catch (error) {
    next(error);
  }
}
