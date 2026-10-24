
import { z } from "zod";
import { AppError } from "../lib/errors.js";

export function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      const validated = { ...req.validated };

      for (const field of ["body", "query", "params"]) {
        const schema = schemas[field];
        if (!schema) continue;

        validated[field] = schema.parse(req[field]);
      }

      req.validated = validated;
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(
          new AppError(
            400,
            "VALIDATION_ERROR",
            "Request validation failed",
            {
              issues: error.issues.map((issue) => ({
                field: issue.path.join(".") || "request",
                message: issue.message,
              })),
            },
          ),
        );
      }

      return next(error);
    }
  };
}
