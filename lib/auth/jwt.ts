import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { randomUUID, createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class TokenExpiredError extends Error {
  constructor(message = "Token has expired") {
    super(message);
    this.name = "TokenExpiredError";
  }
}

export class InvalidTokenError extends Error {
  constructor(message = "Token is invalid") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET deve ter no minimo 32 caracteres");
  }
  return new TextEncoder().encode(secret);
}

function getRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET environment variable is not set");
  }
  if (secret.length < 32) {
    throw new Error("JWT_REFRESH_SECRET deve ter no minimo 32 caracteres");
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

export async function signAccessToken(
  payload: AccessTokenPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getAccessSecret());
}

export async function signRefreshToken(
  payload: RefreshTokenPayload,
  jti?: string
): Promise<string> {
  const builder = new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d");

  if (jti) {
    builder.setJti(jti);
  }

  return builder.sign(getRefreshSecret());
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecret());

    const userId = payload.userId;
    const email = payload.email;

    if (typeof userId !== "string" || typeof email !== "string") {
      throw new InvalidTokenError("Access token payload is malformed");
    }

    return { userId, email };
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      throw new TokenExpiredError();
    }
    if (error instanceof TokenExpiredError || error instanceof InvalidTokenError) {
      throw error;
    }
    throw new InvalidTokenError();
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret());

    const userId = payload.userId;

    if (typeof userId !== "string") {
      throw new InvalidTokenError("Refresh token payload is malformed");
    }

    return { userId };
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      throw new TokenExpiredError();
    }
    if (error instanceof TokenExpiredError || error instanceof InvalidTokenError) {
      throw error;
    }
    throw new InvalidTokenError();
  }
}

// ---------------------------------------------------------------------------
// Helpers para refresh token
// ---------------------------------------------------------------------------

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateTokenFamily(): string {
  return randomUUID();
}
