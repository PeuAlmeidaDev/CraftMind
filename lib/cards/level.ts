// lib/cards/level.ts — Level/XP de UserCard (cristais).
//
// Politica:
// - Quando o jogador derrota um mob e a rolagem de drop daria uma carta que ele
//   ja possui, a duplicata e convertida em XP no UserCard existente.
// - O ganho de XP varia pela raridade do cristal (raras dao mais por copia).
// - Cap de level e 5. XP que ultrapassa o threshold do Lv5 fica acumulado mas
//   nao da efeito (cap visual no UI; modelo permite saber quantas duplicatas
//   foram convertidas no total).
// - O multiplicador de level escala STAT_FLAT e STAT_PERCENT linearmente.

import type { CardRarity } from "@/types/cards";

/** XP ganho por uma duplicata, em funcao da raridade. */
export const XP_PER_DUPLICATE_BY_RARITY: Record<CardRarity, number> = {
  COMUM: 50,
  INCOMUM: 100,
  RARO: 200,
  EPICO: 400,
  LENDARIO: 800,
};

/** Cap de level dos cristais. */
export const CARD_LEVEL_CAP = 5;

/** Threshold cumulativo de XP para alcancar cada level (index = level). */
export const CARD_LEVEL_THRESHOLDS: ReadonlyArray<number> = [0, 0, 100, 250, 500, 1000];
//                                                            Lv1 Lv2  Lv3  Lv4  Lv5
// (index 0 nao usado — levels comecam em 1)

/** Multiplicador de effects por level (index = level). 1.0 a 1.8 em passos de 0.2. */
export const CARD_LEVEL_MULTIPLIER: ReadonlyArray<number> = [1.0, 1.0, 1.2, 1.4, 1.6, 1.8];
//                                                              Lv1  Lv2  Lv3  Lv4  Lv5

export type CardLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Retorna o multiplicador de effect para um level. Clamp em [1, 5].
 * Inputs invalidos (NaN, negativos, > 5) caem para o limite mais proximo.
 */
export function getLevelMultiplier(level: number): number {
  const safe = Math.min(CARD_LEVEL_CAP, Math.max(1, Math.floor(level || 1)));
  return CARD_LEVEL_MULTIPLIER[safe];
}

/**
 * Calcula o level a partir do XP cumulativo. Sempre retorna o maior level
 * cujo threshold foi atingido (range 1..CARD_LEVEL_CAP).
 */
export function getLevelFromXp(totalXp: number): CardLevel {
  if (!Number.isFinite(totalXp) || totalXp < 0) return 1;
  let level: CardLevel = 1;
  for (let lv = CARD_LEVEL_CAP; lv >= 2; lv--) {
    if (totalXp >= CARD_LEVEL_THRESHOLDS[lv]) {
      level = lv as CardLevel;
      break;
    }
  }
  return level;
}

/**
 * Resultado de aplicar XP em uma carta.
 *
 * - `newXp`: XP cumulativo apos aplicar o ganho. Pode ultrapassar o threshold
 *   do Lv5 (nao ha cap de XP — apenas de level).
 * - `newLevel`: Level resultante (1..CARD_LEVEL_CAP).
 * - `leveledUp`: true se o level mudou (estritamente maior).
 * - `xpGained`: XP efetivamente ganho (igual ao input rarity-based).
 */
export type ApplyXpResult = {
  newXp: number;
  newLevel: CardLevel;
  leveledUp: boolean;
  xpGained: number;
};

/**
 * Aplica XP de uma duplicata em uma carta. Recebe estado atual e a raridade
 * da carta para determinar o ganho.
 *
 * `currentLevel` e usado apenas para detectar `leveledUp` — o level resultante
 * vem sempre do recalculo via `getLevelFromXp(newXp)`, garantindo consistencia.
 */
export function applyXpGain(
  currentXp: number,
  currentLevel: number,
  rarity: CardRarity,
): ApplyXpResult {
  const xpGained = XP_PER_DUPLICATE_BY_RARITY[rarity];
  const safeXp = Number.isFinite(currentXp) && currentXp >= 0 ? Math.floor(currentXp) : 0;
  const newXp = safeXp + xpGained;
  const newLevel = getLevelFromXp(newXp);
  const safePrevLevel = Math.min(CARD_LEVEL_CAP, Math.max(1, Math.floor(currentLevel || 1))) as CardLevel;
  return {
    newXp,
    newLevel,
    leveledUp: newLevel > safePrevLevel,
    xpGained,
  };
}
