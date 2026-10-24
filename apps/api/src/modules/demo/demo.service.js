import { randomUUID } from "node:crypto";
import { DEMO_ROLE_LABELS, DEMO_ROLES, isDemoRole } from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { runInTransaction } from "../../lib/transaction.js";
import { hashClientIp } from "../audit/audit.service.js";
import { User, Session } from "../auth/auth.model.js";
import { establishSession } from "../auth/auth.service.js";
import { Merchant, Membership } from "../merchants/merchant.model.js";
import { DEMO_MERCHANT_SLUGS, ensureDemoDataset } from "./demo.seed.js";

const DEMO_DISPLAY_NAMES = Object.freeze({
  MERCHANT: "Demo Merchant",
  ADMIN: "Demo Sandbox Admin",
  DEVELOPER: "Demo Developer",
  RISK_ANALYST: "Demo Risk Analyst",
});

export function demoRoleOptions() {
  return DEMO_ROLES.map((role) => ({
    role,
    label: DEMO_ROLE_LABELS[role],
    readOnly: true,
  }));
}

async function enforceDemoQuota({ req, config }) {
  const ipHash = hashClientIp(req, config.auth.jwtSecret);
  const active = await Session.find({
    isDemo: true,
    ipHash,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();

  const excess = active.length - config.demo.maxActiveSessionsPerIp + 1;
  if (excess > 0) {
    const oldest = active.slice(0, excess).map((session) => session._id);
    await Session.updateMany(
      { _id: { $in: oldest }, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }
}

export async function createDemoSession({ role, req, config, logger }) {
  if (!isDemoRole(role)) {
    throw new AppError(
      422,
      "INVALID_DEMO_ROLE",
      "Requested demo role is not allowed",
    );
  }

  await ensureDemoDataset({ config, logger });

  const slug = DEMO_MERCHANT_SLUGS[role];
  const merchant = await Merchant.findOne({
    slug,
    isDemo: true,
    status: "ACTIVE",
  }).lean();

  if (!merchant) {
    throw new AppError(
      503,
      "DEMO_SANDBOX_UNAVAILABLE",
      "The demo sandbox is not available. Try again shortly.",
    );
  }

  await enforceDemoQuota({ req, config });

  const uniquePart = randomUUID();
  const email = `demo.${role.toLowerCase().replaceAll("_", "-")}.${uniquePart}@sandbox.pratyaya.invalid`;

  return runInTransaction(async (mongoSession) => {
    const [user] = await User.create(
      [
        {
          email,
          displayName: DEMO_DISPLAY_NAMES[role] ?? "Demo User",
          status: "ACTIVE",
          isDemo: true,
          isCredentialless: true,
          demoRole: role,
          demoExpiresAt: new Date(
            Date.now() + config.demo.sessionTtlSeconds * 1000,
          ),
          lastLoginAt: new Date(),
        },
      ],
      { session: mongoSession },
    );

    const [membership] = await Membership.create(
      [
        {
          userId: user._id,
          merchantId: merchant._id,
          role,
          status: "ACTIVE",
          isDemo: true,
        },
      ],
      { session: mongoSession },
    );

    return establishSession({
      user,
      membership,
      merchant,
      req,
      config,
      action: "demo.session.created",
      mongoSession,
    });
  });
}
