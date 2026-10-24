import { notFound } from "../lib/errors.js";

export function notFoundHandler(req, _res, next) {
  next(notFound(`No route matches ${req.method} ${req.path}`));
}
