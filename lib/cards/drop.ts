// lib/cards/drop.ts — Logica de drop de cristais (variantes) e atualizacao de MobKillStat
//
// `applyCardDropAndStats({...})` faz tudo em uma transacao Prisma:
//   1. Upsert MobKillStat (incrementa victories/defeats/damage, atualiza lastSeenAt).
//   2. Se result === "VICTORY", busca o mob com TODAS as suas variantes de Card
//      (uma por requiredStars) e tenta dropar UMA variante por turno seguindo
//      a ordem decrescente de requiredStars (raras primeiro).
//
// Cada variante de Card carrega seu proprio dropChance (0-100). A variante so e
// elegivel se `requiredStars <= encounterStars` (estrela do encontro PvE).
//
// Justificativa da ordem decrescente: matando 3 estrelas, a chance esperada de
// cair Lendaria (ex: 0.3%) deve ser exatamente seu dropChance. Se rolassemos a
// Comum primeiro e ela passasse no roll, a Lendaria nunca seria avaliada.
//
// Politica de duplicatas (atualizada):
// - Se user NAO tem a variante que rolou positivo: cria UserCard novo (drop classico).
// - Se user JA tem: a duplicata e convertida em XP/level no UserCard existente
//   (via applyXpGain de lib/cards/level.ts) e a iteracao PARA. O XP varia pela
//   raridade da carta (50/100/200/400/800 para COMUM/INCOMUM/RARO/EPICO/LENDARIO).
//
// Se nenhuma variante elegivel passar no roll, retorna
// { cardDropped: null, xpGained: null }.

import type { Prisma, PrismaClient, Card } from "@prisma/client";
import { applyXpGain } from "./level";
import type { ApplyXpResult } from "./level";
import type { CardRarity } from "@/types/cards";

export type BattleResult = "VICTORY" | "DEFEAT" | "DRAW";

export type ApplyCardDropAndStatsInput = {
  userId: string;
  mobId: string;
  result: BattleResult;
  /** Dano total causado pelo player ao mob nesta batalha. */
  damageDealt: number;
  /** Estrela do encontro (1, 2 ou 3). Default 1. Define quais variantes sao elegiveis. */
  encounterStars?: number;
  /** Override do RNG (para testes deterministicos). */
  randomFn?: () => number;
};

export type ApplyCardDropAndStatsResult = {
  /** Card NOVA dropada (primeira copia). null caso o drop nao tenha sido uma carta nova. */
  cardDropped: Card | null;
  /** Info de XP ganho por duplicata. null caso o drop nao tenha sido uma duplicata. */
  xpGained: {
    card: Card;
    xp: number;
    newXp: number;
    newLevel: number;
    leveledUp: boolean;
  } | null;
};

/**
 * Atualiza MobKillStat e (se aplicavel) cria UserCard ou aplica XP em uma
 * UserCard existente, em uma transacao Prisma.
 *
 * Regras:
 * - Sempre incrementa o lado correspondente do MobKillStat (victories ou defeats)
 *   e o damage acumulado.
 * - Drop so dispara em VICTORY.
 * - Itera as variantes elegiveis (requiredStars <= encounterStars) em ordem
 *   decrescente de requiredStars.
 * - Para na primeira variante que passa no roll: cria UserCard se nao existir,
 *   ou converte em XP via applyXpGain se ja existir (ambos os casos finalizam
 *   o drop — nao tenta variantes de menor estrela).
 *
 * Aceita um `PrismaClient` ou `TransactionClient` para permitir composicao
 * com outras transacoes externas.
 */
export async function applyCardDropAndStats(
  client: PrismaClient | Prisma.TransactionClient,
  input: ApplyCardDropAndStatsInput,
): Promise<ApplyCardDropAndStatsResult> {
  const {
    userId,
    mobId,
    result,
    damageDealt,
    encounterStars = 1,
    randomFn,
  } = input;

  // 1. Upsert MobKillStat
  const isVictory = result === "VICTORY";
  const isDefeat = result === "DEFEAT";

  const now = new Date();
  await client.mobKillStat.upsert({
    where: { userId_mobId: { userId, mobId } },
    create: {
      userId,
      mobId,
      victories: isVictory ? 1 : 0,
      defeats: isDefeat ? 1 : 0,
      damageDealt,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      victories: { increment: isVictory ? 1 : 0 },
      defeats: { increment: isDefeat ? 1 : 0 },
      damageDealt: { increment: damageDealt },
      lastSeenAt: now,
    },
  });

  // 2. Drop so em VICTORY
  if (!isVictory) {
    return { cardDropped: null, xpGained: null };
  }

  // 3. Buscar mob com todas as variantes de Card
  const mob = await client.mob.findUnique({
    where: { id: mobId },
    include: { cards: true },
  });

  if (!mob || mob.cards.length === 0) {
    return { cardDropped: null, xpGained: null };
  }

  // 4. Filtrar variantes elegiveis (requiredStars <= encounterStars)
  //    e ordenar em ordem decrescente (raras primeiro).
  const eligibleCards: Card[] = mob.cards
    .filter((c) => c.requiredStars <= encounterStars)
    .sort((a, b) => b.requiredStars - a.requiredStars);

  if (eligibleCards.length === 0) {
    return { cardDropped: null, xpGained: null };
  }

  const rng = randomFn ?? Math.random;

  // 5. Iterar variantes em ordem decrescente. Para na primeira variante que
  //    passa no roll: nova => cria UserCard; duplicata => aplica XP.
  for (const card of eligibleCards) {
    const passed = rng() * 100 < card.dropChance;
    if (!passed) {
      continue;
    }

    const existing = await client.userCard.findUnique({
      where: { userId_cardId: { userId, cardId: card.id } },
      select: { id: true, xp: true, level: true },
    });

    if (existing) {
      // Duplicata — converte em XP/level no UserCard existente. Para o iter
      // (drop "concluido" como XP).
      const xpResult: ApplyXpResult = applyXpGain(
        existing.xp,
        existing.level,
        card.rarity as CardRarity,
      );
      await client.userCard.update({
        where: { id: existing.id },
        data: {
          xp: xpResult.newXp,
          level: xpResult.newLevel,
        },
      });
      return {
        cardDropped: null,
        xpGained: {
          card,
          xp: xpResult.xpGained,
          newXp: xpResult.newXp,
          newLevel: xpResult.newLevel,
          leveledUp: xpResult.leveledUp,
        },
      };
    }

    await client.userCard.create({
      data: {
        userId,
        cardId: card.id,
        equipped: false,
        slotIndex: null,
      },
    });

    return { cardDropped: card, xpGained: null };
  }

  return { cardDropped: null, xpGained: null };
}
