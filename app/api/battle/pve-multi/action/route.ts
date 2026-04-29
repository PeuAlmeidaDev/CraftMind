import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { battleActionRateLimit } from "@/lib/rate-limit";
import {
  getMultiPveBattle,
  setMultiPveBattle,
  removeMultiPveBattle,
  isSessionTimedOut,
} from "@/lib/battle/pve-multi-store";
import { resolveMultiPveTurn } from "@/lib/battle/pve-multi-turn";
import type { MobState } from "@/lib/battle/pve-multi-types";
import type { TurnLogEntry } from "@/lib/battle/types";
import { pveMultiActionSchema } from "@/lib/validations/pve-multi";
import { calculateMobExp, calculateExpGained } from "@/lib/exp/formulas";
import { processLevelUp } from "@/lib/exp/level-up";
import { applyCardDropAndStats } from "@/lib/cards/drop";
import type { CardRarity } from "@/types/cards";

const RARITY_RANK: Record<CardRarity, number> = {
  COMUM: 1,
  INCOMUM: 2,
  RARO: 3,
  EPICO: 4,
  LENDARIO: 5,
};

type DroppedCardPayload = {
  id: string;
  name: string;
  rarity: string;
  mobId: string;
};

/** Soma o dano causado pelo player (actorId) a um alvo especifico (targetId === mob.playerId). */
function sumDamageDealtToTarget(
  log: ReadonlyArray<TurnLogEntry>,
  attackerId: string,
  targetPlayerId: string,
): number {
  let total = 0;
  for (const entry of log) {
    if (
      entry.phase === "DAMAGE" &&
      entry.actorId === attackerId &&
      entry.targetId === targetPlayerId &&
      typeof entry.damage === "number"
    ) {
      total += entry.damage;
    }
  }
  return total;
}

/**
 * Para cada mob da batalha multi, atualiza MobKillStat e tenta drop.
 * - Se mob.defeated => VICTORY individual (incrementa victories, rola drop).
 * - Caso contrario => DEFEAT individual (incrementa defeats, sem drop).
 *
 * Retorna o melhor cristal dropado (maior raridade) ou null.
 */
async function applyDropsAndStatsForMobs(
  tx: Prisma.TransactionClient,
  userId: string,
  mobs: ReadonlyArray<MobState>,
  log: ReadonlyArray<TurnLogEntry>,
): Promise<DroppedCardPayload | null> {
  let best: DroppedCardPayload | null = null;
  let bestRank = 0;
  for (const mob of mobs) {
    const damageDealt = sumDamageDealtToTarget(log, userId, mob.playerId);
    const result = mob.defeated ? "VICTORY" : "DEFEAT";
    try {
      const dropResult = await applyCardDropAndStats(tx, {
        userId,
        mobId: mob.mobId,
        result,
        damageDealt,
      });
      if (dropResult.cardDropped) {
        const rank = RARITY_RANK[dropResult.cardDropped.rarity as CardRarity] ?? 0;
        if (rank > bestRank) {
          bestRank = rank;
          best = {
            id: dropResult.cardDropped.id,
            name: dropResult.cardDropped.name,
            rarity: dropResult.cardDropped.rarity,
            mobId: dropResult.cardDropped.mobId,
          };
        }
      }
    } catch (err) {
      console.warn(
        `[pve-multi/action] applyCardDropAndStats falhou para mob ${mob.mobId}: ${String(err)}`,
      );
    }
  }
  return best;
}

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

    // Timeout por inatividade (1 min sem acao)
    if (isSessionTimedOut(session)) {
      const state = session.state;

      const cardDropped = await prisma.$transaction(async (tx) => {
        await tx.pveBattle.create({
          data: {
            userId,
            mobId: state.mobs[0].mobId,
            result: "DEFEAT",
            expGained: 0,
            turns: state.turnNumber,
            log: state.turnLog as object[],
            mode: "MULTI",
            mobIds: state.mobs.map((m) => m.mobId),
          },
        });
        return applyDropsAndStatsForMobs(tx, userId, state.mobs, state.turnLog);
      });

      removeMultiPveBattle(battleId);

      return apiSuccess({
        battleOver: true,
        result: "DEFEAT",
        reason: "INACTIVITY_TIMEOUT",
        expGained: 0,
        events: [],
        playerHp: state.player.currentHp,
        mobsHp: state.mobs.map((m) => m.currentHp),
        mobsDefeated: state.mobs.map((m) => m.defeated),
        cardDropped,
      });
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

          const cardDropped = await prisma.$transaction(async (tx) => {
            await tx.character.update({
              where: { userId },
              data: {
                level: levelResult.newLevel,
                currentExp: levelResult.newExp,
                freePoints: levelResult.newFreePoints,
              },
            });
            await tx.pveBattle.create({
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
            });
            return applyDropsAndStatsForMobs(
              tx,
              userId,
              newState.mobs,
              newState.turnLog,
            );
          });

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
            cardDropped,
          });
        }

        // Character nao encontrado — persistir sem EXP, mas ainda atualizar stats/drop
        const cardDropped = await prisma.$transaction(async (tx) => {
          await tx.pveBattle.create({
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
          return applyDropsAndStatsForMobs(
            tx,
            userId,
            newState.mobs,
            newState.turnLog,
          );
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
          cardDropped,
        });
      }

      // DEFEAT — mobs que o player matou ANTES de morrer ainda contam VICTORY
      // individual; os que sobreviveram contam DEFEAT.
      const cardDropped = await prisma.$transaction(async (tx) => {
        await tx.pveBattle.create({
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
        return applyDropsAndStatsForMobs(
          tx,
          userId,
          newState.mobs,
          newState.turnLog,
        );
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
        cardDropped,
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
