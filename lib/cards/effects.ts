// lib/cards/effects.ts — Aplicacao de efeitos de Card aos stats base do personagem.
//
// Pipeline (Fase 1 + Purity):
//   1. Para cada carta, calcula combinedMultiplier = (purity / 50) * levelMultiplier.
//   2. Soma todos os STAT_FLAT por target (cada effect.value escalado por
//      combinedMultiplier antes do Math.floor).
//   3. Multiplica cada stat por (1 + sum(percents para esse target)/100), onde
//      cada percent ja foi escalado por combinedMultiplier (sem floor).
//   4. Arredonda o resultado final para baixo (Math.floor).
//   5. Garante minimo 1 para evitar dividir por zero em formulas de dano.
//
// Purity e o IV do cristal — 50 = baseline (1.0x, comportamento pre-Fase 1),
// 100 = Espectral (2.0x), 0 = lixo (0.0x). Se a carta nao tiver purity definida
// (null/undefined), usamos baseline 50 (preserva backward-compat com cards
// pre-migration).
//
// TRIGGER e STATUS_RESIST sao IGNORADOS nesta fase (apenas console.warn na primeira
// chamada de cada tipo, para facilitar debug).
//
// O input `equippedCards` aceita tanto o tipo do Prisma (Json) quanto o array
// ja parseado (CardEffect[]). A validacao Zod fica em `lib/validations/cards.ts`.

import type { CardEffect, CardStatFlatEffect, CardStatPercentEffect } from "@/types/cards";
import type { BaseStats } from "@/lib/battle/types";
import type { StatName } from "@/types/skill";
import { getLevelMultiplier } from "./level";
import { getPurityMultiplier } from "./purity";

/** Stat keys validos para BaseStats (sem "accuracy"). */
type CardTargetStat = keyof BaseStats;

const ALLOWED_TARGETS: ReadonlySet<string> = new Set<CardTargetStat>([
  "physicalAtk",
  "physicalDef",
  "magicAtk",
  "magicDef",
  "hp",
  "speed",
]);

function isCardTargetStat(stat: StatName): stat is CardTargetStat {
  return ALLOWED_TARGETS.has(stat);
}

/**
 * Aplica os efeitos de um array de cartas aos stats base.
 *
 * @param baseStats Stats brutos do personagem (do banco, ja com pontos distribuidos).
 * @param equippedCards Array de cards equipadas (cada uma com `effects: CardEffect[]`,
 *   `level: number` e `purity?: number`). `purity` ausente/null e tratado como 50
 *   (baseline 1.0x, preserva comportamento de cards anteriores a migration).
 *   Pode estar vazio — nesse caso retorna baseStats sem alteracao (deep clone).
 */
export function applyCardEffects(
  baseStats: BaseStats,
  equippedCards: ReadonlyArray<{
    effects: ReadonlyArray<CardEffect>;
    level: number;
    purity?: number | null;
  }>,
): BaseStats {
  // Copia mutavel
  const flatBonuses: Record<CardTargetStat, number> = {
    physicalAtk: 0,
    physicalDef: 0,
    magicAtk: 0,
    magicDef: 0,
    hp: 0,
    speed: 0,
  };

  const percentBonuses: Record<CardTargetStat, number> = {
    physicalAtk: 0,
    physicalDef: 0,
    magicAtk: 0,
    magicDef: 0,
    hp: 0,
    speed: 0,
  };

  let warnedTrigger = false;
  let warnedResist = false;
  let warnedAccuracy = false;

  for (const card of equippedCards) {
    const purityMult = getPurityMultiplier(card.purity ?? 50);
    const levelMult = getLevelMultiplier(card.level);
    const multiplier = purityMult * levelMult;
    for (const effect of card.effects) {
      switch (effect.type) {
        case "STAT_FLAT": {
          const flat: CardStatFlatEffect = effect;
          if (!isCardTargetStat(flat.stat)) {
            if (!warnedAccuracy && flat.stat === "accuracy") {
              console.warn(
                "[applyCardEffects] STAT_FLAT em 'accuracy' nao e suportado nos baseStats e foi ignorado.",
              );
              warnedAccuracy = true;
            }
            break;
          }
          flatBonuses[flat.stat] += Math.floor(flat.value * multiplier);
          break;
        }
        case "STAT_PERCENT": {
          const pct: CardStatPercentEffect = effect;
          if (!isCardTargetStat(pct.stat)) {
            if (!warnedAccuracy && pct.stat === "accuracy") {
              console.warn(
                "[applyCardEffects] STAT_PERCENT em 'accuracy' nao e suportado nos baseStats e foi ignorado.",
              );
              warnedAccuracy = true;
            }
            break;
          }
          percentBonuses[pct.stat] += pct.percent * multiplier;
          break;
        }
        case "TRIGGER": {
          if (!warnedTrigger) {
            console.warn(
              "[applyCardEffects] CardEffect TRIGGER e inerte na Fase 1 e foi ignorado.",
            );
            warnedTrigger = true;
          }
          break;
        }
        case "STATUS_RESIST": {
          if (!warnedResist) {
            console.warn(
              "[applyCardEffects] CardEffect STATUS_RESIST e inerte na Fase 1 e foi ignorado.",
            );
            warnedResist = true;
          }
          break;
        }
        default: {
          // Type-safe exhaustiveness — se um novo tipo for adicionado, TS reclama.
          const _exhaustive: never = effect;
          void _exhaustive;
          break;
        }
      }
    }
  }

  // Composicao: (base + flat) * (1 + sum(percents)/100)
  const result: BaseStats = {
    physicalAtk: composeStat(baseStats.physicalAtk, flatBonuses.physicalAtk, percentBonuses.physicalAtk),
    physicalDef: composeStat(baseStats.physicalDef, flatBonuses.physicalDef, percentBonuses.physicalDef),
    magicAtk: composeStat(baseStats.magicAtk, flatBonuses.magicAtk, percentBonuses.magicAtk),
    magicDef: composeStat(baseStats.magicDef, flatBonuses.magicDef, percentBonuses.magicDef),
    hp: composeStat(baseStats.hp, flatBonuses.hp, percentBonuses.hp),
    speed: composeStat(baseStats.speed, flatBonuses.speed, percentBonuses.speed),
  };

  return result;
}

function composeStat(base: number, flat: number, percent: number): number {
  const withFlat = base + flat;
  const multiplier = 1 + percent / 100;
  const composed = Math.floor(withFlat * multiplier);
  // Garante minimo 1 para evitar divisao por zero em formulas de dano.
  return Math.max(1, composed);
}
