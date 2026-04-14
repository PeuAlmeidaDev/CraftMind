import { NextRequest } from "next/server";
import {
  verifyRefreshToken,
  signAccessToken,
  TokenExpiredError,
  InvalidTokenError,
} from "@/lib/auth/jwt";
import { apiSuccess, apiError } from "@/lib/api-response";
import { rotateRefreshToken } from "@/lib/auth/refresh-token";
import { setRefreshTokenCookie, setAccessTokenCookie } from "@/lib/auth/set-auth-cookies";
import { authRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";
    const rateLimitResult = await authRateLimit(`refresh:${ip}`);

    if (!rateLimitResult.success) {
      const retryAfterSeconds = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      const response = apiError("Muitas tentativas. Tente novamente mais tarde.", "RATE_LIMITED", 429);
      response.headers.set("Retry-After", String(retryAfterSeconds));
      return response;
    }

    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (!refreshToken) {
      return apiError("Refresh token ausente", "MISSING_TOKEN", 401);
    }

    const payload = await verifyRefreshToken(refreshToken);

    const rotation = await rotateRefreshToken(refreshToken, {
      userId: payload.userId,
    });

    if (rotation.accessDenied) {
      return apiError("Refresh token invalido", "INVALID_TOKEN", 401);
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: payload.userId },
      select: { email: true },
    });

    const newAccessToken = await signAccessToken({
      userId: payload.userId,
      email: user.email,
    });

    const response = apiSuccess({
      accessToken: newAccessToken,
    });

    setAccessTokenCookie(response, newAccessToken);
    setRefreshTokenCookie(response, rotation.token);

    return response;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return apiError("Refresh token expirado", "TOKEN_EXPIRED", 401);
    }
    if (error instanceof InvalidTokenError) {
      return apiError("Refresh token invalido", "INVALID_TOKEN", 401);
    }

    console.error("[POST /api/auth/refresh]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
