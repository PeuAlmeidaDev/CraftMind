// lib/cards/load-equipped.ts — Carrega cristais equipados do usuario e aplica
// os efeitos sobre os baseStats.
//
// Usado no init de TODAS as batalhas (PvE solo, PvE multi, coop PvE, PvP 1v1,
// PvP team, boss fight). Centraliza a leitura de UserCard.equipped e a
// aplicacao via applyCardEffects.
//
// Aceita PrismaClient OU TransactionClient. Em caso de erro de validacao do
// JSON `effects` de uma carta especifica, o helper IGNORA aquela carta (apenas
// console.warn) — combate jamais deve quebrar por dado de carta corrompido.

import type { Prisma, PrismaClient } from "@prisma/client";
import { applyCardEffects } from "./effects";
import { cardEffectsArraySchema } from "@/lib/validations/cards";
import type { CardEffect } from "@/types/cards";
import type { BaseStats } from "@/lib/battle/types";

/**
 * Le UserCards equipadas (slot 0/1/2) e devolve os baseStats ja com efeitos
 * planos+percentuais aplicados.
 *
 * Se o usuario nao tem cartas equipadas, retorna `baseStats` sem alteracao.
 */
export async function loadEquippedCardsAndApply(
  client: PrismaClient | Prisma.TransactionClient,
  userId: string,
  baseStats: BaseStats,
): Promise<BaseStats> {
  const userCards = await client.userCard.findMany({
    where: { userId, equipped: true },
    include: { card: true },
    orderBy: { slotIndex: "asc" },
  });

  if (userCards.length === 0) {
    return baseStats;
  }

  // Validar effects de cada carta com Zod. Se uma falhar, ignorar.
  const safeCards: { effects: CardEffect[] }[] = [];
  for (const uc of userCards) {
    const parsed = cardEffectsArraySchema.safeParse(uc.card.effects);
    if (!parsed.success) {
      console.warn(
        `[loadEquippedCardsAndApply] Card ${uc.cardId} (user ${userId}) com effects malformado, ignorada: ${parsed.error.message}`,
      );
      continue;
    }
    // O Zod garante a forma; castamos para CardEffect[] (o discriminated union
    // do tipo aplicativo). O schema Zod usa optional em campos por inferencia
    // interna mas .safeParse retorna objetos com todos os campos preenchidos.
    safeCards.push({ effects: parsed.data as unknown as CardEffect[] });
  }

  return applyCardEffects(baseStats, safeCards);
}
