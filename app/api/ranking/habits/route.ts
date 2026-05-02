import { NextRequest } from "next/server";
import {
  verifySession,
  AuthenticationError,
} from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { individualRankingQuerySchema } from "@/lib/validations/ranking";
import { getHabitsRanking } from "@/lib/ranking/habits";
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
    const baseKey = `habits:${house}:${limit}`;
    const cached = cachedRanking(
      () => getHabitsRanking(house, limit),
      baseKey,
    );
    const entries = await cached();

    return apiSuccess({ entries });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/ranking/habits]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
