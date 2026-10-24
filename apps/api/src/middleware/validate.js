import { AppError } from "../lib/errors.js";

function formatIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

export function validate(schemas) {
  return function validateRequest(req, _res, next) {
    const validated = {};

    for (const [key, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[key]);

      if (!result.success) {
        return next(
          new AppError(422, "VALIDATION_ERROR", "Request validation failed", {
            source: key,
            issues: formatIssues(result.error),
          }),
        );
      }

      validated[key] = result.data;
    }

    req.validated = validated;
    return next();
  };
}
