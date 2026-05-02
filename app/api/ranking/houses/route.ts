import { NextRequest } from "next/server";
import {
  verifySession,
  AuthenticationError,
} from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { houseStandardQuerySchema } from "@/lib/validations/ranking";
import { getHouseStandardRanking } from "@/lib/ranking/houses";
import { cachedRanking } from "@/lib/ranking/cache";

export async function GET(request: NextRequest) {
  try {
    await verifySession(request);

    const { searchParams } = new URL(request.url);
    const parsed = houseStandardQuerySchema.safeParse({
      season: searchParams.get("season") ?? undefined,
    });

    if (!parsed.success) {
      return apiError(
        "Parametros invalidos",
        "INVALID_QUERY",
        422,
        parsed.error.flatten(),
      );
    }

    const { season } = parsed.data;
    const baseKey = `houses:${season}`;
    const cached = cachedRanking(
      () => getHouseStandardRanking(season),
      baseKey,
    );
    const entries = await cached();

    return apiSuccess({ entries });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/ranking/houses]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
