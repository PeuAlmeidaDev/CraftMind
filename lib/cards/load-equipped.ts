// lib/cards/load-equipped.ts — Carrega cristais equipados do usuario e aplica
// os efeitos sobre os baseStats. Tambem identifica a skill espectral elegivel
// (Cristal Espectral, purity 100, com spectralSkillId definido) que deve
// habilitar o 5o slot em batalha.
//
// Usado no init de TODAS as batalhas (PvE solo, PvE multi, coop PvE, PvP 1v1,
// PvP team, boss fight). Centraliza a leitura de UserCard.equipped, a
// aplicacao via applyCardEffects e a selecao do cristal espectral contribuidor.
//
// Aceita PrismaClient OU TransactionClient. Em caso de erro de validacao do
// JSON `effects` de uma carta especifica, o helper IGNORA aquela carta (apenas
// console.warn) — combate jamais deve quebrar por dado de carta corrompido.

import type { Prisma, PrismaClient } from "@prisma/client";
import { applyCardEffects } from "./effects";
import { cardEffectsArraySchema } from "@/lib/validations/cards";
import type { CardEffect } from "@/types/cards";
import type { BaseStats } from "@/lib/battle/types";
import type {
  Skill,
  SkillTarget,
  DamageType,
  SkillEffect,
  SkillMastery,
} from "@/types/skill";
import { pickSpectralCardSource } from "./spectral-skill-helpers";

export type LoadedEquipped = {
  baseStats: BaseStats;
  /** Skill espectral elegivel para o 5o slot em batalha. Apenas o cristal
   *  Espectral (purity 100) equipado de menor `slotIndex` contribui — se nao
   *  houver cristal Espectral equipado com `spectralSkillId` valido, fica
   *  `undefined`. Se a Skill referenciada nao existir mais (deletada), faz
   *  skip silencioso (warn) e tambem retorna `undefined`. */
  spectralSkill?: { skill: Skill; sourceUserCardId: string };
};

/**
 * Le UserCards equipadas (slot 0/1/2) e devolve `{ baseStats, spectralSkill? }`.
 *
 * `baseStats` ja vem com efeitos planos+percentuais aplicados. Se nao houver
 * cartas equipadas, retorna `baseStats` original sem alteracao.
 *
 * `spectralSkill` (opcional) e populado se o cristal Espectral equipado de
 * menor `slotIndex` tiver `spectralSkillId` valido e a Skill existir.
 */
export async function loadEquippedCardsAndApply(
  client: PrismaClient | Prisma.TransactionClient,
  userId: string,
  baseStats: BaseStats,
): Promise<LoadedEquipped> {
  const userCards = await client.userCard.findMany({
    where: { userId, equipped: true },
    include: { card: true, spectralSkill: true },
    orderBy: { slotIndex: "asc" },
  });

  if (userCards.length === 0) {
    return { baseStats };
  }

  // Validar effects de cada carta com Zod. Se uma falhar, ignorar.
  const safeCards: { effects: CardEffect[]; level: number; purity: number }[] = [];
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
    safeCards.push({
      effects: parsed.data as unknown as CardEffect[],
      level: uc.level,
      purity: uc.purity,
    });
  }

  const finalStats = applyCardEffects(baseStats, safeCards);

  // ---------------------------------------------------------------------------
  // Skill espectral (5o slot) — apenas o cristal Espectral de menor slotIndex
  // ---------------------------------------------------------------------------
  const candidate = pickSpectralCardSource(userCards);
  if (!candidate) {
    return { baseStats: finalStats };
  }

  if (!candidate.spectralSkill) {
    // spectralSkillId aponta pra Skill inexistente (Skill deletada do banco e
    // onDelete: SetNull nao zerou ainda OU race) — skip silencioso com warn.
    console.warn(
      `[loadEquippedCardsAndApply] UserCard ${candidate.id} tem spectralSkillId ${candidate.spectralSkillId ?? "?"} mas a Skill nao foi carregada (Skill inexistente ou removida)`,
    );
    return { baseStats: finalStats };
  }

  const skill: Skill = {
    id: candidate.spectralSkill.id,
    name: candidate.spectralSkill.name,
    description: candidate.spectralSkill.description,
    tier: candidate.spectralSkill.tier,
    cooldown: candidate.spectralSkill.cooldown,
    target: candidate.spectralSkill.target as SkillTarget,
    damageType: candidate.spectralSkill.damageType as DamageType,
    basePower: candidate.spectralSkill.basePower,
    hits: candidate.spectralSkill.hits,
    accuracy: candidate.spectralSkill.accuracy,
    effects: candidate.spectralSkill.effects as SkillEffect[],
    mastery: candidate.spectralSkill.mastery as SkillMastery,
  };

  return {
    baseStats: finalStats,
    spectralSkill: {
      skill,
      sourceUserCardId: candidate.id,
    },
  };
}
