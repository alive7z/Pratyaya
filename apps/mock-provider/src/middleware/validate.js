import { z } from "zod";
import { AppError } from "../lib/errors.js";

export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.validated = {
          ...req.validated,
          body: schemas.body.parse(req.body),
        };
      }
      if (schemas.query) {
        req.validated = {
          ...req.validated,
          query: schemas.query.parse(req.query),
        };
      }
      if (schemas.params) {
        req.validated = {
          ...req.validated,
          params: schemas.params.parse(req.params),
        };
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return next(
          new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
            issues,
          }),
        );
      }
      next(error);
    }
  };
}
