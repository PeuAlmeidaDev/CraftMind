// lib/cards/effects.ts — Aplicacao de efeitos de Card aos stats base do personagem.
//
// Pipeline (Fase 1):
//   1. Soma todos os STAT_FLAT por target.
//   2. Multiplica cada stat por (1 + sum(percents para esse target)/100).
//   3. Arredonda para baixo (Math.floor).
//   4. Garante minimo 1 para evitar dividir por zero em formulas de dano.
//
// TRIGGER e STATUS_RESIST sao IGNORADOS nesta fase (apenas console.warn na primeira
// chamada de cada tipo, para facilitar debug).
// Cada carta tem um multiplicador `level` (1.0 a 1.8) que escala os bonuses
// STAT_FLAT (Math.floor por effect) e STAT_PERCENT (linear sem floor) antes
// de serem somados aos acumuladores.
//
// O input `equippedCards` aceita tanto o tipo do Prisma (Json) quanto o array
// ja parseado (CardEffect[]). A validacao Zod fica em `lib/validations/cards.ts`.

import type { CardEffect, CardStatFlatEffect, CardStatPercentEffect } from "@/types/cards";
import type { BaseStats } from "@/lib/battle/types";
import type { StatName } from "@/types/skill";
import { getLevelMultiplier } from "./level";

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
 * @param equippedCards Array de cards equipadas (cada uma com `effects: CardEffect[]`).
 *   Pode estar vazio — nesse caso retorna baseStats sem alteracao (deep clone).
 */
export function applyCardEffects(
  baseStats: BaseStats,
  equippedCards: ReadonlyArray<{ effects: ReadonlyArray<CardEffect>; level: number }>,
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
    const multiplier = getLevelMultiplier(card.level);
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
