import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function requestId(req, res, next) {
  const incoming = req.get("X-Request-ID");

  const id =
    typeof incoming === "string" && REQUEST_ID_PATTERN.test(incoming)
      ? incoming
      : randomUUID();

  req.requestId = id;
  res.setHeader("X-Request-ID", id);

  next();
}
