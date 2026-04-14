// lib/battle/damage.ts — Calculo de dano

import type { Skill, PlayerState } from "./types";
import { clampStage, randomMultiplier } from "./utils";
import {
  STAGE_MULTIPLIERS,
  MIN_DAMAGE,
  FROZEN_PHYSICAL_VULN,
} from "./constants";

export function getEffectiveStat(base: number, stage: number): number {
  return base * STAGE_MULTIPLIERS[clampStage(stage)];
}

export function calculateDamage(params: {
  skill: Skill;
  attacker: PlayerState;
  defender: PlayerState;
  comboOverride?: { basePower: number; hits: number };
  randomFn?: () => number;
}): { totalDamage: number; hits: number; damagePerHit: number[] } {
  const { skill, attacker, defender, comboOverride, randomFn } = params;

  // Skills sem dano
  if (skill.damageType === "NONE" && skill.basePower === 0) {
    return { totalDamage: 0, hits: 0, damagePerHit: [] };
  }

  const basePower = comboOverride?.basePower ?? skill.basePower;
  const numHits = comboOverride?.hits ?? skill.hits;

  // Determinar stats de ataque e defesa
  let atkStatKey: "physicalAtk" | "magicAtk";
  let defStatKey: "physicalDef" | "magicDef";

  if (skill.damageType === "MAGICAL") {
    atkStatKey = "magicAtk";
    defStatKey = "magicDef";
  } else {
    // PHYSICAL ou NONE (fallback)
    atkStatKey = "physicalAtk";
    defStatKey = "physicalDef";
  }

  const effectiveAtk = Math.max(0, getEffectiveStat(
    attacker.baseStats[atkStatKey],
    attacker.stages[atkStatKey]
  ));
  const effectiveDef = getEffectiveStat(
    defender.baseStats[defStatKey],
    defender.stages[defStatKey]
  );

  // Garante que defesa nunca e zero/negativa (evita divisao por zero e dano negativo)
  const safeEffectiveDef = Math.max(1, effectiveDef);

  // Calcular multiplicador de vulnerabilidade
  let vulnMultiplier = 1.0;
  for (const vuln of defender.vulnerabilities) {
    if (vuln.damageType === skill.damageType) {
      vulnMultiplier += vuln.percent / 100;
    }
  }

  // Frozen aumenta vulnerabilidade a dano fisico
  if (
    skill.damageType === "PHYSICAL" &&
    defender.statusEffects.some(
      (s) => s.status === "FROZEN" && s.remainingTurns > 0
    )
  ) {
    vulnMultiplier += FROZEN_PHYSICAL_VULN;
  }

  // Calcular dano por hit
  const damagePerHit: number[] = [];
  for (let i = 0; i < numHits; i++) {
    const rawDamage =
      (basePower * (effectiveAtk / safeEffectiveDef) * 0.5 + basePower * 0.1) *
      vulnMultiplier *
      randomMultiplier(randomFn);
    const finalDamage = Math.max(MIN_DAMAGE, Math.floor(rawDamage));
    damagePerHit.push(finalDamage);
  }

  const totalDamage = damagePerHit.reduce((sum, d) => sum + d, 0);

  return { totalDamage, hits: numHits, damagePerHit };
}
