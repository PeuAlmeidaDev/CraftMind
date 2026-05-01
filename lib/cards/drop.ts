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
// Politica "primeira copia por cardId": se o usuario ja possui aquele cardId,
// a iteracao avanca para a proxima variante (em vez de retornar null), porque
// pode haver outra variante ainda nao coletada nesta mesma rolagem.
//
// Se nenhuma variante elegivel passar no roll (ou todas as que passaram ja
// estavam coletadas), retorna { cardDropped: null }.

import type { Prisma, PrismaClient, Card } from "@prisma/client";

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
 * - Itera as variantes elegiveis (requiredStars <= encounterStars) em ordem
 *   decrescente de requiredStars. Para na primeira variante que dropa e o
 *   usuario ainda nao possui (politica "primeira copia").
 * - Se o user ja possui a card que rolou positivo, continua para a proxima.
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
    return { cardDropped: null };
  }

  // 3. Buscar mob com todas as variantes de Card
  const mob = await client.mob.findUnique({
    where: { id: mobId },
    include: { cards: true },
  });

  if (!mob || mob.cards.length === 0) {
    return { cardDropped: null };
  }

  // 4. Filtrar variantes elegiveis (requiredStars <= encounterStars)
  //    e ordenar em ordem decrescente (raras primeiro).
  const eligibleCards: Card[] = mob.cards
    .filter((c) => c.requiredStars <= encounterStars)
    .sort((a, b) => b.requiredStars - a.requiredStars);

  if (eligibleCards.length === 0) {
    return { cardDropped: null };
  }

  const rng = randomFn ?? Math.random;

  // 5. Iterar variantes em ordem decrescente. Para no primeiro drop bem-sucedido
  //    em que o user ainda nao possui a copia.
  for (const card of eligibleCards) {
    const passed = rng() * 100 < card.dropChance;
    if (!passed) {
      continue;
    }

    const existing = await client.userCard.findUnique({
      where: { userId_cardId: { userId, cardId: card.id } },
      select: { id: true },
    });

    if (existing) {
      // Usuario ja possui esta variante — tenta a proxima.
      continue;
    }

    await client.userCard.create({
      data: {
        userId,
        cardId: card.id,
        equipped: false,
        slotIndex: null,
      },
    });

    return { cardDropped: card };
  }

  return { cardDropped: null };
}
