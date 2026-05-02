// lib/cards/spectral-skill-helpers.ts — Helpers puros para selecao da skill
// espectral contribuidora (5o slot em batalha).
//
// Regra de selecao: apenas o cristal Espectral (purity 100) equipado de menor
// `slotIndex` E com `spectralSkillId` definido contribui. Se o jogador equipar
// 3 Espectrais nos slots 0, 1, 2, somente a do slot 0 ativa o 5o slot.
//
// Funcao pura, sem acesso a banco. Aceita uma lista de UserCards equipadas
// (ja com `slotIndex` resolvido) e retorna a primeira elegivel ou null.

import type { Prisma } from "@prisma/client";

export type EquippedUserCardForSpectral = Prisma.UserCardGetPayload<{
  include: { card: true; spectralSkill: true };
}>;

/**
 * Filtra cristais Espectrais (purity 100) com `spectralSkillId` setado, ordena
 * por `slotIndex` ASC e retorna o primeiro. Retorna `null` se nenhum.
 *
 * Nao verifica se a Skill existe (caller decide o que fazer com `spectralSkill`
 * possivelmente null).
 */
export function pickSpectralCardSource(
  cards: EquippedUserCardForSpectral[],
): EquippedUserCardForSpectral | null {
  const candidates = cards.filter(
    (c) => c.purity === 100 && c.spectralSkillId !== null && c.equipped,
  );
  if (candidates.length === 0) return null;

  // Ordena por slotIndex ASC. Cristais com slotIndex null vao pro fim
  // (defensivo — equipped=true deveria garantir slotIndex != null).
  candidates.sort((a, b) => {
    const aIdx = a.slotIndex ?? Number.MAX_SAFE_INTEGER;
    const bIdx = b.slotIndex ?? Number.MAX_SAFE_INTEGER;
    return aIdx - bIdx;
  });

  return candidates[0];
}
