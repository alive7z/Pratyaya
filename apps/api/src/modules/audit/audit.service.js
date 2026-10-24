import { createHmac } from "node:crypto";
import { AuditLog } from "./audit.model.js";

function clientIp(req) {
  return req?.ip || req?.socket?.remoteAddress || "unknown";
}

export function hashClientIp(req, secret) {
  return createHmac("sha256", secret)
    .update(clientIp(req))
    .digest("hex")
    .slice(0, 32);
}

export async function recordAudit(
  {
    action,
    outcome = "SUCCESS",
    actorUserId,
    actorRole,
    merchantId,
    resourceType,
    resourceId,
    req,
    metadata,
    isDemo = false,
  },
  { session, secret } = {},
) {
  const document = {
    action,
    outcome,
    actorUserId,
    actorRole,
    merchantId,
    resourceType,
    resourceId: resourceId === undefined ? undefined : String(resourceId),
    ipHash: req && secret ? hashClientIp(req, secret) : undefined,
    userAgent: req?.get?.("user-agent")?.slice(0, 256),
    metadata,
    isDemo,
  };

  if (session) {
    const [created] = await AuditLog.create([document], { session });
    return created;
  }

  return AuditLog.create(document);
}
