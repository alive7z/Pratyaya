import { AppError } from "../lib/errors.js";
import { responseMeta } from "../lib/response.js";

export function errorHandler(logger) {
  return function handleError(error, req, res, _next) {
    if (res.headersSent) {
      return;
    }

    let statusCode = 500;
    let code = "INTERNAL_ERROR";
    let message = "An unexpected error occurred";
    let details;

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      code = error.code;
      message = error.message;
      details = error.details;
    } else if (error?.type === "entity.parse.failed") {
      statusCode = 400;
      code = "INVALID_JSON";
      message = "Request body is not valid JSON";
    } else if (error?.type === "entity.too.large") {
      statusCode = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "Request body exceeds the configured limit";
    }

    if (statusCode >= 500) {
      logger.error(
        { event: "http.error", requestId: req.requestId, err: error },
        "Unhandled request error",
      );
    } else {
      logger.warn(
        {
          event: "http.error",
          requestId: req.requestId,
          code,
          statusCode,
          message: error.message,
        },
        "Request rejected",
      );
    }

    const body = {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
      meta: responseMeta(req.requestId),
    };

    res.status(statusCode).json(body);
  };
}
