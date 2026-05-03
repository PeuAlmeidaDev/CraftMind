import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { battleActionRateLimit } from "@/lib/rate-limit";
import {
  getPveBattle,
  setPveBattle,
  removePveBattle,
  isSessionTimedOut,
} from "@/lib/battle/pve-store";
import { resolveTurn } from "@/lib/battle/turn";
import { chooseAction } from "@/lib/battle/ai";
import { pveBattleActionSchema } from "@/lib/validations/battle";
import { calculateMobExp, calculateExpGained } from "@/lib/exp/formulas";
import { STAR_STAT_MULTIPLIER, type EncounterStars } from "@/lib/mobs/encounter-stars";
import { processLevelUp } from "@/lib/exp/level-up";
import { applyCardDropAndStats, dispatchSpectralBroadcast } from "@/lib/cards/drop";
import type { TurnAction, TurnLogEntry } from "@/lib/battle/types";

/** Soma o dano causado pelo player (actorId === userId) ao mob (targetId === mobId). */
function sumDamageDealt(
  log: ReadonlyArray<TurnLogEntry>,
  attackerId: string,
  targetId: string,
): number {
  let total = 0;
  for (const entry of log) {
    if (
      entry.phase === "DAMAGE" &&
      entry.actorId === attackerId &&
      entry.targetId === targetId &&
      typeof entry.damage === "number"
    ) {
      total += entry.damage;
    }
  }
  return total;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const rl = await battleActionRateLimit(userId);
    if (!rl.success) {
      return apiError("Acao muito rapida, aguarde", "RATE_LIMITED", 429);
    }

    const body: unknown = await request.json();
    const parsed = pveBattleActionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Dados invalidos",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const { battleId, skillId } = parsed.data;

    const session = getPveBattle(battleId);
    if (!session) {
      return apiError("Batalha nao encontrada", "BATTLE_NOT_FOUND", 404);
    }

    if (session.userId !== userId) {
      return apiError("Esta batalha nao pertence a voce", "NOT_YOUR_BATTLE", 403);
    }

    // Timeout por inatividade (1 min sem acao)
    if (isSessionTimedOut(session)) {
      const damageDealt = sumDamageDealt(
        session.state.turnLog,
        userId,
        session.mobId,
      );
      await prisma.$transaction(async (tx) => {
        await tx.pveBattle.create({
          data: {
            userId,
            mobId: session.mobId,
            result: "DEFEAT",
            expGained: 0,
            turns: session.state.turnNumber,
            log: session.state.turnLog as object[],
          },
        });
        await applyCardDropAndStats(tx, {
          userId,
          mobId: session.mobId,
          result: "DEFEAT",
          damageDealt,
          encounterStars: session.encounterStars,
        });
      });

      removePveBattle(battleId);

      return apiSuccess({
        events: [],
        playerHp: session.state.players[0].currentHp,
        mobHp: session.state.players[1].currentHp,
        battleOver: true,
        result: "DEFEAT",
        reason: "INACTIVITY_TIMEOUT",
        expGained: 0,
        levelsGained: 0,
        newLevel: 0,
        cardDropped: null,
      });
    }

    if (session.state.status === "FINISHED") {
      return apiError(
        "Esta batalha ja terminou",
        "BATTLE_ALREADY_FINISHED",
        400
      );
    }

    // Montar acoes do turno
    const playerAction: TurnAction = { playerId: userId, skillId };
    const mobAction = chooseAction({
      state: session.state,
      mobPlayerId: session.mobId,
      profile: session.mobProfile,
    });

    const { state: newState, events } = resolveTurn(session.state, [
      playerAction,
      mobAction,
    ]);

    // Batalha terminou
    if (newState.status === "FINISHED") {
      let result: "VICTORY" | "DEFEAT" | "DRAW";
      if (newState.winnerId === userId) {
        result = "VICTORY";
      } else if (newState.winnerId === null) {
        result = "DRAW";
      } else {
        result = "DEFEAT";
      }

      const damageDealt = sumDamageDealt(
        newState.turnLog,
        userId,
        session.mobId,
      );

      let expGained = 0;
      let levelsGained = 0;
      let newLevel = 0;
      let cardDropped: {
        id: string;
        name: string;
        rarity: string;
        mobId: string;
        purity: number;
      } | null = null;

      if (result === "VICTORY") {
        // Buscar mob e character para calculo de EXP
        const [mob, character] = await Promise.all([
          prisma.mob.findUnique({
            where: { id: session.mobId },
            select: {
              physicalAtk: true,
              physicalDef: true,
              magicAtk: true,
              magicDef: true,
              hp: true,
              speed: true,
              tier: true,
            },
          }),
          prisma.character.findUnique({
            where: { userId },
            select: { level: true, currentExp: true, freePoints: true },
          }),
        ]);

        if (mob && character) {
          const baseExp = calculateMobExp(mob);
          expGained = calculateExpGained(baseExp, character.level, mob.tier);
          const stars = (session.encounterStars ?? 1) as EncounterStars;
          expGained = Math.max(1, Math.floor(expGained * STAR_STAT_MULTIPLIER[stars]));
          const totalExp = character.currentExp + expGained;

          const levelResult = processLevelUp({
            level: character.level,
            currentExp: totalExp,
            freePoints: character.freePoints,
          });

          levelsGained = levelResult.levelsGained;
          newLevel = levelResult.newLevel;

          // Transaction: atualizar character + criar registro PveBattle + drop/stats de cristal
          const dropResult = await prisma.$transaction(async (tx) => {
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
                mobId: session.mobId,
                result,
                expGained,
                turns: newState.turnNumber,
                log: newState.turnLog as object[],
              },
            });
            return applyCardDropAndStats(tx, {
              userId,
              mobId: session.mobId,
              result,
              damageDealt,
              encounterStars: session.encounterStars,
            });
          });

          if (dropResult.cardDropped) {
            cardDropped = {
              id: dropResult.cardDropped.id,
              name: dropResult.cardDropped.name,
              rarity: dropResult.cardDropped.rarity,
              mobId: dropResult.cardDropped.mobId,
              purity: dropResult.cardDropped.purity,
            };
          }

          // Broadcast global de Espectral (purity 100) — fire and forget,
          // FORA da transacao. Erros nao quebram a resposta do drop.
          if (dropResult.spectralDrop) {
            void dispatchSpectralBroadcast({
              userId,
              spectralDrop: dropResult.spectralDrop,
            });
          }
        } else {
          // Mob ou character nao encontrado — persistir historico sem EXP, mas
          // ainda atualizar MobKillStat (drop nao dispara sem mob.tier).
          const fallbackDrop = await prisma.$transaction(async (tx) => {
            await tx.pveBattle.create({
              data: {
                userId,
                mobId: session.mobId,
                result,
                expGained: 0,
                turns: newState.turnNumber,
                log: newState.turnLog as object[],
              },
            });
            return applyCardDropAndStats(tx, {
              userId,
              mobId: session.mobId,
              result,
              damageDealt,
              encounterStars: session.encounterStars,
            });
          });
          if (fallbackDrop.spectralDrop) {
            void dispatchSpectralBroadcast({
              userId,
              spectralDrop: fallbackDrop.spectralDrop,
            });
          }
        }
      } else {
        // Derrota ou empate: registrar batalha sem EXP + atualizar MobKillStat
        await prisma.$transaction(async (tx) => {
          await tx.pveBattle.create({
            data: {
              userId,
              mobId: session.mobId,
              result,
              expGained: 0,
              turns: newState.turnNumber,
              log: newState.turnLog as object[],
            },
          });
          await applyCardDropAndStats(tx, {
            userId,
            mobId: session.mobId,
            result,
            damageDealt,
            encounterStars: session.encounterStars,
          });
        });
      }

      removePveBattle(battleId);

      return apiSuccess({
        events,
        playerHp: newState.players[0].currentHp,
        mobHp: newState.players[1].currentHp,
        battleOver: true,
        result,
        expGained,
        levelsGained,
        newLevel,
        cardDropped,
      });
    }

    // Batalha continua
    session.state = newState;
    setPveBattle(battleId, session);

    return apiSuccess({
      events,
      playerHp: newState.players[0].currentHp,
      mobHp: newState.players[1].currentHp,
      battleOver: false,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/battle/pve/action]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
