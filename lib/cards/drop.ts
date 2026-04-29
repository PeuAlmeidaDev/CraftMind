// lib/cards/drop.ts — Logica de drop de cristais e atualizacao de MobKillStat
//
// `rollCardDrop(tier)` decide se um cristal cai com base na tabela TIER_DROP_RATE.
// `applyCardDropAndStats({...})` faz tudo em uma transacao Prisma:
//   1. Upsert MobKillStat (incrementa victories/defeats/damage, atualiza lastSeenAt).
//   2. Se result === "VICTORY" e o mob tem Card cadastrada e o roll deu drop,
//      tenta criar UserCard (skipDuplicates pela unique [userId, cardId]).
//
// A funcao retorna a Card dropada (caso tenha sido a primeira copia) ou null
// (sem drop OU duplicata bloqueada pela politica "so primeira copia").

import type { Prisma, PrismaClient, Card } from "@prisma/client";
import { TIER_DROP_RATE } from "@/types/cards";

/**
 * Rola se o cristal cai para um determinado tier.
 *
 * @param tier 1-5
 * @param randomFn Opcional — para testes deterministicos.
 */
export function rollCardDrop(tier: number, randomFn: () => number = Math.random): boolean {
  const rate = TIER_DROP_RATE[tier];
  if (rate === undefined) {
    return false;
  }
  return randomFn() < rate;
}

export type BattleResult = "VICTORY" | "DEFEAT" | "DRAW";

export type ApplyCardDropAndStatsInput = {
  userId: string;
  mobId: string;
  result: BattleResult;
  /** Dano total causado pelo player ao mob nesta batalha. */
  damageDealt: number;
  /** Roll opcional ja calculado externamente (para testes). Se omitido, rola internamente. */
  drop?: boolean;
  /** Override do RNG quando `drop` nao e fornecido. */
  randomFn?: () => number;
};

export type ApplyCardDropAndStatsResult = {
  /** Card dropada (primeira copia). null caso nao haja drop ou duplicata bloqueada. */
  cardDropped: Card | null;
};

/**
 * Atualiza MobKillStat e (se aplicavel) cria UserCard em uma transacao Prisma.
 *
 * Regras:
 * - Sempre incrementa o lado correspondente do MobKillStat (victories ou defeats)
 *   e o damage acumulado.
 * - Drop so dispara em VICTORY.
 * - Se o mob nao tem Card cadastrado, retorna null mesmo com roll positivo.
 * - Se o user ja possui a card, retorna null (politica "so primeira copia").
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
    drop,
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
    return { cardDropped: null };
  }

  // 3. Buscar mob (precisa do tier) + card vinculada
  const mob = await client.mob.findUnique({
    where: { id: mobId },
    select: {
      tier: true,
      card: true,
    },
  });

  if (!mob || !mob.card) {
    return { cardDropped: null };
  }

  // 4. Roll
  const shouldDrop =
    drop !== undefined ? drop : rollCardDrop(mob.tier, randomFn);
  if (!shouldDrop) {
    return { cardDropped: null };
  }

  // 5. Tentar criar UserCard. Se ja existe (constraint unique), nao faz nada.
  const existing = await client.userCard.findUnique({
    where: { userId_cardId: { userId, cardId: mob.card.id } },
    select: { id: true },
  });

  if (existing) {
    return { cardDropped: null };
  }

  await client.userCard.create({
    data: {
      userId,
      cardId: mob.card.id,
      equipped: false,
      slotIndex: null,
    },
  });

  return { cardDropped: mob.card };
}
