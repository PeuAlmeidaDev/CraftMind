import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { revokeRefreshTokenByValue } from "@/lib/auth/refresh-token";
import { clearAuthCookies } from "@/lib/auth/set-auth-cookies";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimitResult = await authRateLimit(`logout:${ip}`);

  if (!rateLimitResult.success) {
    const retryAfterSeconds = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
    const response = apiError(
      "Muitas tentativas. Tente novamente mais tarde.",
      "RATE_LIMIT_EXCEEDED",
      429
    );
    response.headers.set("Retry-After", String(retryAfterSeconds));
    return response;
  }

  const refreshToken = request.cookies.get("refresh_token")?.value;

  if (refreshToken) {
    try {
      await revokeRefreshTokenByValue(refreshToken);
    } catch (error) {
      console.error("[POST /api/auth/logout] Erro ao revogar token:", error);
    }
  }

  const response = apiSuccess(null);
  clearAuthCookies(response);

  return response;
}
