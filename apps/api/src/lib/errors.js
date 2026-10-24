export class AppError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expected = true;
  }
}

export function notFound(message = "Route not found") {
  return new AppError(404, "NOT_FOUND", message);
}
