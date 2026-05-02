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
// Politica de duplicatas (Fase 1 — Purity):
// - Se user NAO tem a variante que rolou positivo: cria UserCard novo (drop classico)
//   com purity rolada via `rollPurity`. Floor de 30 aplicado para variantes 3⭐.
// - Se user JA tem: rola purity da nova copia.
//   * Se nova_purity > purity_atual: cria PendingCardDuplicate e NAO toca xp/level.
//     Jogador resolve via UI (REPLACE substitui purity zerando xp/level; CONVERT
//     converte em XP normal mantendo purity atual).
//   * Se nova_purity <= purity_atual: comportamento legado — converte em XP via
//     applyXpGain.
//
// Espectral (Fase 2 — purity === 100):
// - Quando um UserCard NOVO e criado com purity 100, a mesma transacao registra
//   um `SpectralDropLog` (append-only) e o retorno inclui `spectralDrop` com
//   `userCardId` e `cardName` para que o caller dispare `broadcastGlobal`
//   FORA da transacao (fire-and-forget).
// - Duplicatas com nova purity 100 NAO disparam log/broadcast aqui — elas
//   entram no fluxo de PendingCardDuplicate e o broadcast acontece no momento
//   da resolucao REPLACE (quando a UserCard de fato adota purity 100).
//
// Se nenhuma variante elegivel passar no roll, retorna
// { cardDropped: null, xpGained: null, pendingDuplicate: null, spectralDrop: null }.

import type { Prisma, PrismaClient, Card } from "@prisma/client";
import { applyXpGain } from "./level";
import type { ApplyXpResult } from "./level";
import { rollPurity, SPECTRAL_PURITY } from "./purity";
import type { CardRarity } from "@/types/cards";
import { prisma } from "@/lib/prisma";
import { broadcastGlobal } from "@/lib/socket-emitter";

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
  cardDropped: (Card & { purity: number }) | null;
  /** Info de XP ganho por duplicata (nova_purity <= purity_atual). null caso o drop
   *  nao tenha sido uma duplicata convertida em XP. */
  xpGained: {
    card: Card;
    xp: number;
    newXp: number;
    newLevel: number;
    leveledUp: boolean;
  } | null;
  /** Pendencia criada quando duplicata tem purity MAIOR que a atual. null caso
   *  contrario. Jogador resolve via /api/cards/pending-duplicates/[id]/resolve. */
  pendingDuplicate: {
    id: string;
    card: Card;
    currentPurity: number;
    newPurity: number;
  } | null;
  /** Set quando um UserCard NOVO e criado com purity 100 (Espectral). O caller
   *  deve disparar `broadcastGlobal('global:spectral-drop', {...})` FORA da
   *  transacao (fire-and-forget). null em qualquer outro cenario (incluindo
   *  duplicata com nova purity 100, que vira PendingCardDuplicate). */
  spectralDrop: {
    userCardId: string;
    cardName: string;
    mobName: string;
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
    return { cardDropped: null, xpGained: null, pendingDuplicate: null, spectralDrop: null };
  }

  // 3. Buscar mob com todas as variantes de Card
  const mob = await client.mob.findUnique({
    where: { id: mobId },
    include: { cards: true },
  });

  if (!mob || mob.cards.length === 0) {
    return { cardDropped: null, xpGained: null, pendingDuplicate: null, spectralDrop: null };
  }

  // 4. Filtrar variantes elegiveis (requiredStars <= encounterStars)
  //    e ordenar em ordem decrescente (raras primeiro).
  const eligibleCards: Card[] = mob.cards
    .filter((c) => c.requiredStars <= encounterStars)
    .sort((a, b) => b.requiredStars - a.requiredStars);

  if (eligibleCards.length === 0) {
    return { cardDropped: null, xpGained: null, pendingDuplicate: null, spectralDrop: null };
  }

  const rng = randomFn ?? Math.random;

  // 5. Iterar variantes em ordem decrescente. Para na primeira variante que
  //    passa no roll. Comportamento depende de existencia da copia:
  //      - Nova: cria UserCard com purity rolada.
  //      - Duplicata com nova_purity > atual: cria PendingCardDuplicate (nao toca xp/level).
  //      - Duplicata com nova_purity <= atual: aplica XP via applyXpGain.
  for (const card of eligibleCards) {
    const passed = rng() * 100 < card.dropChance;
    if (!passed) {
      continue;
    }

    const existing = await client.userCard.findUnique({
      where: { userId_cardId: { userId, cardId: card.id } },
      select: { id: true, xp: true, level: true, purity: true },
    });

    // Rola a purity da nova copia (mesma curva pra novo e duplicata).
    const newPurity = rollPurity(rng, card.requiredStars);

    if (existing) {
      // Duplicata — comportamento depende da comparacao de purity.
      if (newPurity > existing.purity) {
        // Nova copia melhor: criar pendencia, NAO tocar xp/level. Jogador
        // resolve via UI (REPLACE ou CONVERT).
        const pending = await client.pendingCardDuplicate.create({
          data: {
            userId,
            userCardId: existing.id,
            newPurity,
          },
          select: { id: true },
        });
        return {
          cardDropped: null,
          xpGained: null,
          pendingDuplicate: {
            id: pending.id,
            card,
            currentPurity: existing.purity,
            newPurity,
          },
          spectralDrop: null,
        };
      }

      // Nova copia menor ou igual: comportamento legado — vira XP.
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
        pendingDuplicate: null,
        spectralDrop: null,
      };
    }

    // Carta nova: cria UserCard com purity rolada.
    const createdUserCard = await client.userCard.create({
      data: {
        userId,
        cardId: card.id,
        equipped: false,
        slotIndex: null,
        purity: newPurity,
      },
      select: { id: true },
    });

    // Espectral: registra log append-only DENTRO da transacao. O caller
    // dispara `broadcastGlobal('global:spectral-drop', ...)` FORA da transacao
    // (fire-and-forget) usando o `spectralDrop` retornado.
    let spectralDrop: ApplyCardDropAndStatsResult["spectralDrop"] = null;
    if (newPurity === SPECTRAL_PURITY) {
      await client.spectralDropLog.create({
        data: {
          userId,
          userCardId: createdUserCard.id,
        },
      });
      spectralDrop = {
        userCardId: createdUserCard.id,
        cardName: card.name,
        mobName: mob.name,
      };
    }

    return {
      cardDropped: { ...card, purity: newPurity },
      xpGained: null,
      pendingDuplicate: null,
      spectralDrop,
    };
  }

  return { cardDropped: null, xpGained: null, pendingDuplicate: null, spectralDrop: null };
}

// ---------------------------------------------------------------------------
// Helper para callers do drop: dispara broadcast global de Espectral.
// ---------------------------------------------------------------------------

/**
 * Helper a ser chamado FORA da transacao Prisma quando `applyCardDropAndStats`
 * retorna `spectralDrop != null`. Faz lookup do nome do dropper e dispara
 * `broadcastGlobal('global:spectral-drop', ...)` fire-and-forget.
 *
 * Erros de banco/rede sao silenciados — broadcast e cosmetico, drop ja foi
 * commitado com sucesso na transacao quando esta funcao roda.
 */
export async function dispatchSpectralBroadcast(params: {
  userId: string;
  spectralDrop: NonNullable<ApplyCardDropAndStatsResult["spectralDrop"]>;
}): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { name: true },
    });
    if (!user) return;

    await broadcastGlobal("global:spectral-drop", {
      userId: params.userId,
      userName: user.name,
      cardName: params.spectralDrop.cardName,
      mobName: params.spectralDrop.mobName,
    });
  } catch (err) {
    console.warn(
      "[drop] dispatchSpectralBroadcast falhou:",
      err instanceof Error ? err.message : err,
    );
  }
}
