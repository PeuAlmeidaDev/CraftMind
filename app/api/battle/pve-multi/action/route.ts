import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { battleActionRateLimit } from "@/lib/rate-limit";
import {
  getMultiPveBattle,
  setMultiPveBattle,
  removeMultiPveBattle,
} from "@/lib/battle/pve-multi-store";
import { resolveMultiPveTurn } from "@/lib/battle/pve-multi-turn";
import { pveMultiActionSchema } from "@/lib/validations/pve-multi";
import { calculateMobExp, calculateExpGained } from "@/lib/exp/formulas";
import { processLevelUp } from "@/lib/exp/level-up";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const rl = await battleActionRateLimit(userId);
    if (!rl.success) {
      return apiError("Acao muito rapida, aguarde", "RATE_LIMITED", 429);
    }

    const body: unknown = await request.json();
    const parsed = pveMultiActionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const { battleId, skillId, targetIndex } = parsed.data;

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

    // Resolver turno
    const { state: newState, events } = resolveMultiPveTurn(
      session.state,
      { skillId, targetIndex }
    );

    // Batalha terminou
    if (newState.status === "FINISHED") {
      const mobIds = newState.mobs.map((m) => m.mobId);
      // Usar o primeiro mobId como referencia para a relacao com Mob
      const primaryMobId = mobIds[0];

      if (newState.result === "VICTORY") {
        // Calcular EXP: soma de cada mob derrotado
        const character = await prisma.character.findUnique({
          where: { userId },
          select: { level: true, currentExp: true, freePoints: true },
        });

        if (character) {
          let totalExp = 0;

          for (const mob of newState.mobs) {
            if (mob.defeated) {
              const mobData = await prisma.mob.findUnique({
                where: { id: mob.mobId },
                select: {
                  physicalAtk: true,
                  physicalDef: true,
                  magicAtk: true,
                  magicDef: true,
                  hp: true,
                  speed: true,
                  tier: true,
                },
              });

              if (mobData) {
                const baseExp = calculateMobExp(mobData);
                totalExp += calculateExpGained(baseExp, character.level, mobData.tier);
              }
            }
          }

          const modeBonus = newState.mode === "1v5" ? 1.2 : newState.mode === "1v3" ? 1.1 : 1;
          const expWithPenalty = Math.floor(totalExp * modeBonus);
          const totalCharExp = character.currentExp + expWithPenalty;

          const levelResult = processLevelUp({
            level: character.level,
            currentExp: totalCharExp,
            freePoints: character.freePoints,
          });

          await prisma.$transaction([
            prisma.character.update({
              where: { userId },
              data: {
                level: levelResult.newLevel,
                currentExp: levelResult.newExp,
                freePoints: levelResult.newFreePoints,
              },
            }),
            prisma.pveBattle.create({
              data: {
                userId,
                mobId: primaryMobId,
                result: "VICTORY",
                expGained: expWithPenalty,
                turns: newState.turnNumber,
                log: newState.turnLog as object[],
                mode: "MULTI",
                mobIds,
              },
            }),
          ]);

          removeMultiPveBattle(battleId);

          return apiSuccess({
            events,
            playerHp: newState.player.currentHp,
            mobsHp: newState.mobs.map((m) => m.currentHp),
            mobsDefeated: newState.mobs.map((m) => m.defeated),
            battleOver: true,
            result: "VICTORY",
            expGained: expWithPenalty,
            levelsGained: levelResult.levelsGained,
            newLevel: levelResult.newLevel,
          });
        }

        // Character nao encontrado — persistir sem EXP
        await prisma.pveBattle.create({
          data: {
            userId,
            mobId: primaryMobId,
            result: "VICTORY",
            expGained: 0,
            turns: newState.turnNumber,
            log: newState.turnLog as object[],
            mode: "MULTI",
            mobIds,
          },
        });

        removeMultiPveBattle(battleId);

        return apiSuccess({
          events,
          playerHp: newState.player.currentHp,
          mobsHp: newState.mobs.map((m) => m.currentHp),
          mobsDefeated: newState.mobs.map((m) => m.defeated),
          battleOver: true,
          result: "VICTORY",
          expGained: 0,
        });
      }

      // DEFEAT
      await prisma.pveBattle.create({
        data: {
          userId,
          mobId: primaryMobId,
          result: "DEFEAT",
          expGained: 0,
          turns: newState.turnNumber,
          log: newState.turnLog as object[],
          mode: "MULTI",
          mobIds,
        },
      });

      removeMultiPveBattle(battleId);

      return apiSuccess({
        events,
        playerHp: newState.player.currentHp,
        mobsHp: newState.mobs.map((m) => m.currentHp),
        mobsDefeated: newState.mobs.map((m) => m.defeated),
        battleOver: true,
        result: "DEFEAT",
        expGained: 0,
      });
    }

    // Batalha continua
    session.state = newState;
    setMultiPveBattle(battleId, session);

    return apiSuccess({
      events,
      playerHp: newState.player.currentHp,
      mobsHp: newState.mobs.map((m) => m.currentHp),
      mobsDefeated: newState.mobs.map((m) => m.defeated),
      battleOver: false,
      result: null,
      expGained: 0,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/battle/pve-multi/action]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
