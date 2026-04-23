import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getPveBattle, removePveBattle } from "@/lib/battle/pve-store";
import { pveForfeitSchema } from "@/lib/validations/battle";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const body: unknown = await request.json();
    const parsed = pveForfeitSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const { battleId } = parsed.data;

    const session = getPveBattle(battleId);
    if (!session) {
      return apiError("Batalha nao encontrada", "BATTLE_NOT_FOUND", 404);
    }

    if (session.userId !== userId) {
      return apiError("Esta batalha nao pertence a voce", "NOT_YOUR_BATTLE", 403);
    }

    if (session.state.status === "FINISHED") {
      return apiError("Esta batalha ja terminou", "BATTLE_ALREADY_FINISHED", 400);
    }

    await prisma.pveBattle.create({
      data: {
        userId,
        mobId: session.mobId,
        result: "DEFEAT",
        expGained: 0,
        turns: session.state.turnNumber,
        log: session.state.turnLog as object[],
      },
    });

    removePveBattle(battleId);

    return apiSuccess({
      battleOver: true,
      result: "DEFEAT",
      reason: "FORFEIT",
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/battle/pve/forfeit]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
