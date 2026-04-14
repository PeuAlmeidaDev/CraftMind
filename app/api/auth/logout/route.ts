import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { revokeRefreshTokenByValue } from "@/lib/auth/refresh-token";
import { clearAuthCookies } from "@/lib/auth/set-auth-cookies";

export async function POST(request: NextRequest) {
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
