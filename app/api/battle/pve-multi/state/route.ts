import { NextRequest } from "next/server";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  getMultiPveBattle,
  removeMultiPveBattle,
  isSessionTimedOut,
} from "@/lib/battle/pve-multi-store";

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

    // Timeout por inatividade (1 min sem acao) — somente leitura, sem persistir no banco
    if (isSessionTimedOut(session)) {
      removeMultiPveBattle(battleId);

      return apiSuccess({
        battleOver: true,
        result: "DEFEAT",
        reason: "INACTIVITY_TIMEOUT",
      });
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
      playerSkills: state.player.equippedSkills.map((es) => ({
        skillId: es.skillId,
        slotIndex: es.slotIndex,
        name: es.skill.name,
        description: es.skill.description,
        basePower: es.skill.basePower,
        damageType: es.skill.damageType,
        target: es.skill.target,
        cooldown: state.player.cooldowns[es.skillId] ?? 0,
        accuracy: es.skill.accuracy,
        fromSpectralCard: es.fromSpectralCard ?? false,
      })),
      mobs: state.mobs.map((mob, index) => ({
        index,
        hp: mob.currentHp,
        maxHp: mob.baseStats.hp,
        defeated: mob.defeated,
        name: session.mobsInfo[index]?.name ?? `Mob ${index + 1}`,
        tier: session.mobsInfo[index]?.tier ?? 1,
        imageUrl: session.mobsInfo[index]?.imageUrl ?? null,
        playerId: mob.playerId,
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
