import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  getMultiPveBattle,
  removeMultiPveBattle,
} from "@/lib/battle/pve-multi-store";
import { pveMultiForfeitSchema } from "@/lib/validations/pve-multi";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const body: unknown = await request.json();
    const parsed = pveMultiForfeitSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const { battleId } = parsed.data;

    const session = getMultiPveBattle(battleId);
    if (!session) {
      return apiError("Batalha nao encontrada", "BATTLE_NOT_FOUND", 404);
    }

    if (session.userId !== userId) {
      return apiError("Esta batalha nao pertence a voce", "NOT_YOUR_BATTLE", 403);
    }

    if (session.state.status === "FINISHED") {
      return apiError(
        "Esta batalha ja terminou",
        "BATTLE_ALREADY_FINISHED",
        400
      );
    }

    await prisma.pveBattle.create({
      data: {
        userId,
        mobId: session.state.mobs[0].mobId,
        result: "DEFEAT",
        expGained: 0,
        turns: session.state.turnNumber,
        log: session.state.turnLog as object[],
        mode: "MULTI",
        mobIds: session.state.mobs.map((m) => m.mobId),
      },
    });

    removeMultiPveBattle(battleId);

    return apiSuccess({ battleOver: true, result: "DEFEAT", reason: "FORFEIT" });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/battle/pve-multi/forfeit]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
