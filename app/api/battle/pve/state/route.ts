import { NextRequest } from "next/server";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getPveBattle } from "@/lib/battle/pve-store";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const battleId = request.nextUrl.searchParams.get("battleId");
    if (!battleId) {
      return apiError("battleId e obrigatorio", "MISSING_BATTLE_ID", 400);
    }

    const session = getPveBattle(battleId);
    if (!session) {
      return apiError("Batalha nao encontrada", "BATTLE_NOT_FOUND", 404);
    }

    if (session.userId !== userId) {
      return apiError("Esta batalha nao pertence a voce", "NOT_YOUR_BATTLE", 403);
    }

    const playerState = session.state.players[0];
    const mobState = session.state.players[1];
    return apiSuccess({
      battleId,
      turnNumber: session.state.turnNumber,
      status: session.state.status,
      player: {
        currentHp: playerState.currentHp,
        maxHp: playerState.baseStats.hp,
        stages: playerState.stages,
        statusEffects: playerState.statusEffects,
        buffs: playerState.buffs,
        availableSkills: playerState.equippedSkills.map((es) => ({
          skillId: es.skillId,
          slotIndex: es.slotIndex,
          name: es.skill.name,
          description: es.skill.description,
          basePower: es.skill.basePower,
          damageType: es.skill.damageType,
          target: es.skill.target,
          cooldown: playerState.cooldowns[es.skillId] ?? 0,
          accuracy: es.skill.accuracy,
        })),
      },
      mob: {
        currentHp: mobState.currentHp,
        maxHp: mobState.baseStats.hp,
        statusEffects: mobState.statusEffects,
        name: session.mobName,
        description: session.mobDescription,
        tier: session.mobTier,
        imageUrl: session.mobImageUrl,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/battle/pve/state]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
