import mongoose from "mongoose";
import { ROLES, permissionsForRole } from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  issueAccessToken,
  newTokenFamilyId,
} from "../../lib/tokens.js";
import { runInTransaction } from "../../lib/transaction.js";
import { recordAudit, hashClientIp } from "../audit/audit.service.js";
import { Merchant, Membership } from "../merchants/merchant.model.js";
import { Session, User } from "./auth.model.js";

const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$NJGRbElIKBZuJWyfe68pKQ$wPTGPAju7tmPlFmk3mi1pfzDzc3mNvY6XZlKiMDGRPyAIDt-MRZeg92n3g-OAoWi8mEjVhN042kxnDxvBLU0wg";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

export function sanitizeUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    isDemo: Boolean(user.isDemo),
    demoRole: user.demoRole ?? null,
    createdAt: user.createdAt,
  };
}

function sanitizeMerchant(merchant) {
  return {
    id: String(merchant._id),
    name: merchant.name,
    slug: merchant.slug,
    currency: merchant.currency,
    status: merchant.status,
    isDemo: Boolean(merchant.isDemo),
  };
}

export function serializeAuthResult(result) {
  const { user, membership, merchant, session } = result;

  return {
    user: sanitizeUser(user),
    membership: {
      id: String(membership._id),
      role: membership.role,
      status: membership.status,
      merchant: sanitizeMerchant(merchant),
    },
    session: {
      id: String(session._id),
      isDemo: Boolean(session.isDemo),
      expiresAt: session.expiresAt,
      demoExpiresAt: session.demoExpiresAt ?? null,
      accessExpiresAt: result.accessExpiresAt,
    },
    permissions: permissionsForRole(membership.role),
    accessToken: result.accessToken,
    tokenType: "Bearer",
    csrfToken: result.csrfToken,
  };
}

export async function establishSession({
  user,
  membership,
  merchant,
  req,
  config,
  action,
  mongoSession,
  familyId = newTokenFamilyId(),
}) {
  const now = Date.now();
  const isDemo = Boolean(user.isDemo || membership.isDemo);
  const refreshTtlSeconds = isDemo
    ? Math.min(
        config.demo.sessionTtlSeconds,
        config.auth.refreshTokenTtlSeconds,
      )
    : config.auth.refreshTokenTtlSeconds;

  const expiresAt = new Date(now + refreshTtlSeconds * 1000);
  const demoExpiresAt = isDemo ? expiresAt : undefined;
  const refreshToken = generateOpaqueToken();
  const csrfToken = generateOpaqueToken(24);
  const refreshTokenHash = hashOpaqueToken(refreshToken);

  const session = new Session({
    userId: user._id,
    merchantId: merchant._id,
    role: membership.role,
    familyId,
    refreshTokenHash,
    expiresAt,
    demoExpiresAt,
    lastUsedAt: new Date(now),
    ipHash: hashClientIp(req, config.auth.jwtSecret),
    userAgent: req.get?.("user-agent")?.slice(0, 256),
    isDemo,
  });

  await session.save({ session: mongoSession });

  const access = issueAccessToken({
    userId: user._id,
    sessionId: session._id,
    role: membership.role,
    merchantId: merchant._id,
    isDemo,
    secret: config.auth.jwtSecret,
    issuer: config.auth.issuer,
    audience: config.auth.audience,
    ttlSeconds: config.auth.accessTokenTtlSeconds,
    now,
  });

  await recordAudit(
    {
      action,
      actorUserId: user._id,
      actorRole: membership.role,
      merchantId: merchant._id,
      resourceType: "session",
      resourceId: session._id,
      req,
      isDemo,
      metadata: { role: membership.role },
    },
    { session: mongoSession, secret: config.auth.jwtSecret },
  );

  return {
    user,
    membership,
    merchant,
    session,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    csrfToken,
    refreshToken,
    refreshTokenTtlSeconds: Math.floor((expiresAt.getTime() - now) / 1000),
  };
}

export async function registerUser({ input, req, config }) {
  const existing = await User.exists({ email: input.email });
  if (existing) {
    throw new AppError(409, "EMAIL_IN_USE", "An account already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const merchantSlugBase = slugify(input.merchantName) || "merchant";
  const merchantSlug = `${merchantSlugBase}-${new mongoose.Types.ObjectId()
    .toString()
    .slice(-6)}`;

  try {
    return await runInTransaction(async (mongoSession) => {
      const [merchant] = await Merchant.create(
        [
          {
            name: input.merchantName,
            slug: merchantSlug,
            status: "ACTIVE",
            currency: "USD",
            isDemo: false,
          },
        ],
        { session: mongoSession },
      );

      const [user] = await User.create(
        [
          {
            email: input.email,
            passwordHash,
            displayName: input.displayName,
            status: "ACTIVE",
            isDemo: false,
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
            role: ROLES.MERCHANT,
            status: "ACTIVE",
            isDemo: false,
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
        action: "auth.registered",
        mongoSession,
      });
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(409, "EMAIL_IN_USE", "An account already exists");
    }
    throw error;
  }
}

export async function loginUser({ input, req, config }) {
  const user = await User.findOne({ email: input.email }).select(
    "+passwordHash",
  );

  const passwordMatches = await verifyPassword(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches || user.status !== "ACTIVE") {
    await recordAudit(
      {
        action: "auth.login",
        outcome: "DENIED",
        resourceType: "user",
        req,
        secret: config.auth.jwtSecret,
        metadata: { reason: "INVALID_CREDENTIALS" },
      },
      { secret: config.auth.jwtSecret },
    ).catch(() => {});
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect",
    );
  }

  const membership = await Membership.findOne({
    userId: user._id,
    status: "ACTIVE",
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!membership) {
    throw new AppError(403, "NO_ACTIVE_MEMBERSHIP", "No active membership");
  }

  const merchant = await Merchant.findById(membership.merchantId).lean();
  if (!merchant || merchant.status !== "ACTIVE") {
    throw new AppError(403, "MERCHANT_UNAVAILABLE", "Merchant is unavailable");
  }

  return runInTransaction(async (mongoSession) => {
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } },
      { session: mongoSession },
    );

    return establishSession({
      user,
      membership,
      merchant,
      req,
      config,
      action: "auth.login",
      mongoSession,
    });
  });
}

async function revokeFamily(familyId) {
  const now = new Date();
  await Session.updateMany(
    { familyId, revokedAt: { $exists: false } },
    { $set: { revokedAt: now } },
  );
}

export async function refreshSession({ refreshToken, req, config }) {
  if (!refreshToken) {
    throw new AppError(401, "REFRESH_REQUIRED", "A refresh token is required");
  }

  const refreshTokenHash = hashOpaqueToken(refreshToken);
  const existing = await Session.findOne({ refreshTokenHash });

  if (!existing) {
    throw new AppError(401, "INVALID_SESSION", "Session is invalid");
  }

  if (existing.revokedAt) {
    await revokeFamily(existing.familyId);
    throw new AppError(401, "SESSION_REUSED", "Session has been revoked");
  }

  const now = Date.now();
  if (
    existing.expiresAt.getTime() <= now ||
    (existing.demoExpiresAt && existing.demoExpiresAt.getTime() <= now)
  ) {
    await revokeFamily(existing.familyId);
    throw new AppError(401, "SESSION_EXPIRED", "Session has expired");
  }

  const user = await User.findById(existing.userId);
  if (!user || user.status !== "ACTIVE") {
    throw new AppError(401, "INVALID_SESSION", "Session is invalid");
  }

  const membership = await Membership.findOne({
    userId: user._id,
    merchantId: existing.merchantId,
    role: existing.role,
    status: "ACTIVE",
  }).lean();

  const merchant = await Merchant.findById(existing.merchantId).lean();
  if (
    !membership ||
    !merchant ||
    merchant.status !== "ACTIVE" ||
    (existing.isDemo && (!user.isDemo || !merchant.isDemo))
  ) {
    await revokeFamily(existing.familyId);
    throw new AppError(401, "INVALID_SESSION", "Session is invalid");
  }

  return runInTransaction(async (mongoSession) => {
    const result = await establishSession({
      user,
      membership,
      merchant,
      req,
      config,
      action: "auth.refreshed",
      mongoSession,
      familyId: existing.familyId,
    });

    await Session.updateOne(
      { _id: existing._id, revokedAt: { $exists: false } },
      {
        $set: {
          revokedAt: new Date(now),
          replacedBySessionId: result.session._id,
        },
      },
      { session: mongoSession },
    );

    return result;
  });
}

export async function logoutSession({ refreshToken, auth, req, config }) {
  let session = null;

  if (refreshToken) {
    session = await Session.findOne({
      refreshTokenHash: hashOpaqueToken(refreshToken),
    });
  }

  if (!session && auth?.session?._id) {
    session = await Session.findById(auth.session._id);
  }

  if (!session) {
    return { revoked: false };
  }

  await revokeFamily(session.familyId);

  await recordAudit(
    {
      action: "auth.logout",
      actorUserId: session.userId,
      actorRole: session.role,
      merchantId: session.merchantId,
      resourceType: "session",
      resourceId: session._id,
      req,
      isDemo: session.isDemo,
    },
    { secret: config.auth.jwtSecret },
  ).catch(() => {});

  return { revoked: true };
}

export async function currentAuthPayload(auth) {
  return serializeAuthResult({
    user: auth.user,
    membership: auth.membership,
    merchant: auth.merchant,
    session: auth.session,
    accessToken: auth.accessToken,
    accessExpiresAt: auth.accessExpiresAt,
    csrfToken: auth.csrfToken,
  });
}
