import { NextRequest } from "next/server";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getMultiPveBattle } from "@/lib/battle/pve-multi-store";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const { searchParams } = new URL(request.url);
    const battleId = searchParams.get("battleId");

    if (!battleId) {
      return apiError("battleId e obrigatorio", "MISSING_BATTLE_ID", 400);
    }

    const session = getMultiPveBattle(battleId);
    if (!session) {
      return apiError("Batalha nao encontrada", "BATTLE_NOT_FOUND", 404);
    }

    if (session.userId !== userId) {
      return apiError("Esta batalha nao pertence a voce", "NOT_YOUR_BATTLE", 403);
    }

    const state = session.state;

    // Retornar estado sanitizado (sem mob profiles, sem mob skill details)
    return apiSuccess({
      battleId: state.battleId,
      mode: state.mode,
      turnNumber: state.turnNumber,
      status: state.status,
      result: state.result,
      playerHp: state.player.currentHp,
      playerMaxHp: state.player.baseStats.hp,
      playerStatusEffects: state.player.statusEffects.map((se) => ({
        status: se.status,
        remainingTurns: se.remainingTurns,
      })),
      playerCooldowns: state.player.cooldowns,
      mobs: state.mobs.map((mob, index) => ({
        index,
        hp: mob.currentHp,
        maxHp: mob.baseStats.hp,
        defeated: mob.defeated,
        statusEffects: mob.statusEffects.map((se) => ({
          status: se.status,
          remainingTurns: se.remainingTurns,
        })),
      })),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/battle/pve-multi/state]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
