import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "craft-mind-admin-2026";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body.token as string | undefined;

    if (!token || token !== ADMIN_TOKEN) {
      return apiError("Token invalido", "INVALID_TOKEN", 401);
    }

    return apiSuccess({ authenticated: true });
  } catch (error) {
    console.error("[POST /api/admin/auth]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
