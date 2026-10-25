export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;

    if (details !== undefined) {
      this.details = details;
    }

    Error.captureStackTrace?.(this, AppError);
  }
}
