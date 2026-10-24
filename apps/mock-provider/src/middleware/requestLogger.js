
export function requestLogger(logger) {
  return function logRequest(req, res, next) {
    const startedAt = process.hrtime.bigint();
    let logged = false;

    function logCompletion(event) {
      if (logged) return;
      logged = true;

      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      const statusCode = res.statusCode;

      const metadata = {
        event: "http.request",
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        completed: event === "finish",
      };

      const message =
        event === "finish"
          ? "Mock provider request completed"
          : "Mock provider request connection closed";

      if (event === "close" || statusCode >= 500) {
        logger.error(metadata, message);
      } else if (statusCode >= 400) {
        logger.warn(metadata, message);
      } else {
        logger.info(metadata, message);
      }
    }

    res.once("finish", () => logCompletion("finish"));
    res.once("close", () => logCompletion("close"));

    next();
  };
}
