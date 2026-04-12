import {
  verifyAccessToken,
  TokenExpiredError,
  InvalidTokenError,
  type AccessTokenPayload,
} from "@/lib/auth/jwt";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class AuthenticationError extends Error {
  readonly code: "MISSING_TOKEN" | "TOKEN_EXPIRED" | "INVALID_TOKEN";
  readonly statusCode: 401;

  constructor(
    message: string,
    code: "MISSING_TOKEN" | "TOKEN_EXPIRED" | "INVALID_TOKEN"
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
    this.statusCode = 401;
  }
}

// ---------------------------------------------------------------------------
// Token extraction helpers
// ---------------------------------------------------------------------------

function extractTokenFromHeader(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7);
  }
  return null;
}

function extractTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("access_token="));

  if (!match) return null;

  return match.split("=")[1] ?? null;
}

// ---------------------------------------------------------------------------
// Main helper
// ---------------------------------------------------------------------------

/**
 * Extrai e verifica o access token de uma request.
 *
 * Ordem de busca:
 * 1. Header `Authorization: Bearer <token>`
 * 2. Cookie `access_token`
 *
 * @throws {AuthenticationError} se token ausente, expirado ou invalido
 */
export async function verifySession(
  request: Request
): Promise<AccessTokenPayload> {
  const token =
    extractTokenFromHeader(request) ?? extractTokenFromCookie(request);

  if (!token) {
    throw new AuthenticationError(
      "Token de acesso nao fornecido",
      "MISSING_TOKEN"
    );
  }

  try {
    return await verifyAccessToken(token);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new AuthenticationError("Token expirado", "TOKEN_EXPIRED");
    }
    if (error instanceof InvalidTokenError) {
      throw new AuthenticationError("Token invalido", "INVALID_TOKEN");
    }
    throw new AuthenticationError("Token invalido", "INVALID_TOKEN");
  }
}
