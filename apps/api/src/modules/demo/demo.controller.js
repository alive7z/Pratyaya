import { DEMO_ROLE_LABELS, roleHomePath } from "@pratyaya/shared";
import { sendData } from "../../lib/response.js";
import { applySessionCookies } from "../auth/auth.controller.js";
import { serializeAuthResult } from "../auth/auth.service.js";
import { createDemoSession, demoRoleOptions } from "./demo.service.js";

export function listDemoRoles(req, res) {
  sendData(req, res, {
    roles: demoRoleOptions(),
    notice:
      "Demo sessions are credential-free, revocable, short-lived, and limited to read-only synthetic sandbox data.",
  });
}

export async function createSession(req, res, next) {
  try {
    const { role } = req.validated.body;
    const config = req.app.locals.config;
    const result = await createDemoSession({
      role,
      req,
      config,
      logger: req.app.locals.logger,
    });

    applySessionCookies(res, config, result);

    sendData(
      req,
      res,
      {
        ...serializeAuthResult(result),
        demo: {
          role,
          label: DEMO_ROLE_LABELS[role],
          readOnly: true,
          notice:
            "You are exploring a synthetic sandbox. No real money, cards, bank details, or personal data are present.",
        },
        redirectTo: roleHomePath(role),
      },
      201,
    );
  } catch (error) {
    next(error);
  }
}
