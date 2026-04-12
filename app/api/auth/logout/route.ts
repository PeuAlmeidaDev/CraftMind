import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { revokeRefreshTokenByValue } from "@/lib/auth/refresh-token";

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

  response.cookies.set("access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 0,
  });

  return response;
}
