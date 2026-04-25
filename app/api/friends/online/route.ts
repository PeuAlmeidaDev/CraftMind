import { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    await verifySession(request);
  } catch {
    return apiError("Nao autenticado", "UNAUTHORIZED", 401);
  }

  const userIds = request.nextUrl.searchParams.get("userIds");
  if (!userIds) {
    return apiError("userIds obrigatorio", "VALIDATION_ERROR", 422);
  }

  const ids = userIds.split(",").filter(Boolean);
  if (ids.length > 50) {
    return apiError("Max 50 userIds", "VALIDATION_ERROR", 422);
  }

  const socketUrl = process.env.SOCKET_SERVER_URL;
  const secret = process.env.SOCKET_INTERNAL_SECRET;
  if (!socketUrl || !secret) {
    return apiError("Configuracao de socket ausente", "INTERNAL_ERROR", 500);
  }

  try {
    const res = await fetch(
      `${socketUrl}/internal/online-check?userIds=${ids.join(",")}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );

    if (!res.ok) {
      return apiError("Erro ao consultar status online", "INTERNAL_ERROR", 500);
    }

    const data = (await res.json()) as { statuses: Record<string, boolean> };
    return apiSuccess(data.statuses);
  } catch {
    return apiError("Erro de conexao com servidor socket", "INTERNAL_ERROR", 500);
  }
}
