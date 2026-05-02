import { NextRequest } from "next/server";
import {
  verifySession,
  AuthenticationError,
} from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { individualRankingQuerySchema } from "@/lib/validations/ranking";
import { getPvpRanking } from "@/lib/ranking/pvp";
import { cachedRanking } from "@/lib/ranking/cache";

export async function GET(request: NextRequest) {
  try {
    await verifySession(request);

    const { searchParams } = new URL(request.url);
    const parsed = individualRankingQuerySchema.safeParse({
      house: searchParams.get("house") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return apiError(
        "Parametros invalidos",
        "INVALID_QUERY",
        422,
        parsed.error.flatten(),
      );
    }

    const { house, limit } = parsed.data;
    const baseKey = `pvp-1v1:${house}:${limit}`;
    const cached = cachedRanking(
      () => getPvpRanking("SOLO_1V1", house, limit),
      baseKey,
    );
    const entries = await cached();

    return apiSuccess({ entries });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/ranking/pvp-1v1]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
