import { NextRequest } from "next/server";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getPveBattle, removePveBattle, isSessionTimedOut } from "@/lib/battle/pve-store";
import type {
  ActiveBuff,
  ActiveVulnerability,
  ActiveCounter,
} from "@/lib/battle/types";

// Sanitizers — removem campos internos da engine (id, onExpire, onTrigger)
// antes de expor ao cliente. Mantem apenas o que o frontend precisa renderizar.

function sanitizeActiveBuff(b: ActiveBuff) {
  return {
    source: b.source,
    stat: b.stat,
    value: b.value,
    remainingTurns: b.remainingTurns,
  };
}

function sanitizeVuln(v: ActiveVulnerability) {
  return {
    damageType: v.damageType,
    percent: v.percent,
    remainingTurns: v.remainingTurns,
  };
}

function sanitizeCounter(c: ActiveCounter) {
  return {
    powerMultiplier: c.powerMultiplier,
    remainingTurns: c.remainingTurns,
  };
}

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

    if (isSessionTimedOut(session)) {
      removePveBattle(battleId);
      return apiSuccess({
        battleOver: true,
        result: "DEFEAT",
        reason: "INACTIVITY_TIMEOUT",
      });
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
        buffs: playerState.buffs.map(sanitizeActiveBuff),
        vulnerabilities: playerState.vulnerabilities.map(sanitizeVuln),
        counters: playerState.counters.map(sanitizeCounter),
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
          fromSpectralCard: es.fromSpectralCard ?? false,
        })),
      },
      mob: {
        currentHp: mobState.currentHp,
        maxHp: mobState.baseStats.hp,
        statusEffects: mobState.statusEffects,
        buffs: mobState.buffs.map(sanitizeActiveBuff),
        vulnerabilities: mobState.vulnerabilities.map(sanitizeVuln),
        counters: mobState.counters.map(sanitizeCounter),
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
