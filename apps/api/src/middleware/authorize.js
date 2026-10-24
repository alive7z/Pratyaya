import { AppError } from "../lib/errors.js";

export function authorize(...requiredPermissions) {
  return function authorizeRequest(req, _res, next) {
    if (!req.auth) {
      return next(
        new AppError(401, "UNAUTHENTICATED", "Authentication is required"),
      );
    }

    const granted = new Set(req.auth.permissions);
    const allowed = requiredPermissions.every((permission) =>
      granted.has(permission),
    );

    if (!allowed) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to perform this action",
        ),
      );
    }

    return next();
  };
}

export function requireDemoSandbox(req, _res, next) {
  if (!req.auth?.isDemo || !req.auth?.merchant?.isDemo) {
    return next(
      new AppError(
        403,
        "DEMO_SCOPE_REQUIRED",
        "This capability is restricted to the demo sandbox",
      ),
    );
  }

  return next();
}

export function requireRole(...roles) {
  return function requireRoleRequest(req, _res, next) {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "Your role is not allowed to access this resource",
        ),
      );
    }

    return next();
  };
}
