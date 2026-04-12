import { NextRequest } from "next/server";
import {
  verifyRefreshToken,
  signAccessToken,
  TokenExpiredError,
  InvalidTokenError,
} from "@/lib/auth/jwt";
import { apiSuccess, apiError } from "@/lib/api-response";
import { rotateRefreshToken } from "@/lib/auth/refresh-token";
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

    response.cookies.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 15, // 15 minutos
    });

    response.cookies.set("refresh_token", rotation.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

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
