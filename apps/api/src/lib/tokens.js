import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const TOKEN_ALGORITHM = "HS256";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64urlJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signSegment(header, payload, secret) {
  return createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
}

export function generateOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function newTokenFamilyId() {
  return randomUUID();
}

export function issueAccessToken({
  userId,
  sessionId,
  role,
  merchantId,
  isDemo,
  secret,
  issuer,
  audience,
  ttlSeconds,
  now = Date.now(),
}) {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const header = base64url(
    JSON.stringify({ alg: TOKEN_ALGORITHM, typ: "JWT" }),
  );
  const payload = base64url(
    JSON.stringify({
      sub: String(userId),
      sid: String(sessionId),
      role,
      mid: String(merchantId),
      demo: Boolean(isDemo),
      iss: issuer,
      aud: audience,
      iat: issuedAt,
      exp: expiresAt,
      jti: randomUUID(),
    }),
  );
  const signature = signSegment(header, payload, secret);

  return {
    token: `${header}.${payload}.${signature}`,
    expiresAt: new Date(expiresAt * 1000),
  };
}

export class InvalidTokenError extends Error {
  constructor(message = "Access token is invalid or expired") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

export function verifyAccessToken(
  token,
  { secret, issuer, audience, now = Date.now() },
) {
  if (typeof token !== "string") throw new InvalidTokenError();

  const segments = token.split(".");
  if (segments.length !== 3) throw new InvalidTokenError();

  const [header, payload, signature] = segments;
  const expected = signSegment(header, payload, secret);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new InvalidTokenError();
  }

  let decodedHeader;
  let decodedPayload;
  try {
    decodedHeader = decodeBase64urlJson(header);
    decodedPayload = decodeBase64urlJson(payload);
  } catch {
    throw new InvalidTokenError();
  }

  if (decodedHeader.alg !== TOKEN_ALGORITHM || decodedHeader.typ !== "JWT") {
    throw new InvalidTokenError();
  }

  if (decodedPayload.iss !== issuer || decodedPayload.aud !== audience) {
    throw new InvalidTokenError();
  }

  if (
    typeof decodedPayload.exp !== "number" ||
    decodedPayload.exp * 1000 <= now
  ) {
    throw new InvalidTokenError();
  }

  if (
    typeof decodedPayload.sub !== "string" ||
    typeof decodedPayload.sid !== "string" ||
    typeof decodedPayload.mid !== "string" ||
    typeof decodedPayload.role !== "string"
  ) {
    throw new InvalidTokenError();
  }

  return decodedPayload;
}
