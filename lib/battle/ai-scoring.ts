// lib/battle/ai-scoring.ts — Pontuacao de skills para decisao da IA

import type { Skill, PlayerState, ComboState } from "./types";
import type { AiProfile, ProfileModifiers } from "./ai-profiles";
import { AI_PROFILES } from "./ai-profiles";

type SkillCategory = "damage" | "support" | "control";

export function scoreSkill(params: {
  skill: Skill;
  mob: PlayerState;
  opponent: PlayerState;
  profile: AiProfile;
  comboState: ComboState;
  randomFn?: () => number;
}): number {
  const { skill, mob, opponent, profile, comboState, randomFn } = params;

  // 1. Classificar skill
  const isDamage = skill.basePower > 0 && skill.damageType !== "NONE";
  const isSupport = skill.effects.some((e) =>
    ["HEAL", "BUFF", "CLEANSE", "COUNTER"].includes(e.type)
  );
  const isControl = skill.effects.some((e) =>
    ["DEBUFF", "STATUS", "VULNERABILITY"].includes(e.type)
  );

  // 2. Score base
  let score = isDamage ? skill.basePower / 10 : 5;

  // 3. Bonus contextuais (cumulativos)

  // HP critico do mob — priorizar cura
  const hasHeal = skill.effects.some((e) => e.type === "HEAL");
  if (mob.currentHp < mob.baseStats.hp * 0.3 && hasHeal) {
    score += 50;
  } else if (
    mob.currentHp >= mob.baseStats.hp * 0.3 &&
    mob.currentHp < mob.baseStats.hp * 0.5 &&
    hasHeal
  ) {
    score += 25;
  }

  // Oponente com HP alto — priorizar dano forte
  if (
    opponent.currentHp > opponent.baseStats.hp * 0.7 &&
    isDamage &&
    skill.basePower >= 60
  ) {
    score += 30;
  }

  // Oponente sem debuffs — priorizar debuff/status
  const hasDebuffOrStatus = skill.effects.some(
    (e) => e.type === "DEBUFF" || e.type === "STATUS"
  );
  if (
    opponent.buffs.filter((b) => b.source === "DEBUFF").length === 0 &&
    hasDebuffOrStatus
  ) {
    score += 25;
  }

  // Mob sem buffs — priorizar buff
  const hasBuff = skill.effects.some((e) => e.type === "BUFF");
  if (mob.buffs.filter((b) => b.source === "BUFF").length === 0 && hasBuff) {
    score += 20;
  }

  // Oponente vulneravel ao tipo de dano da skill
  if (
    opponent.vulnerabilities.some((v) => v.damageType === skill.damageType)
  ) {
    score += 35;
  }

  // Combo ativo com esta skill
  if (
    comboState.skillId === skill.id &&
    skill.effects.some((e) => e.type === "COMBO")
  ) {
    score += 15 * comboState.stacks;
  }

  // Oponente quase morto — priorizar dano para finalizar
  if (opponent.currentHp < opponent.baseStats.hp * 0.2 && isDamage) {
    score += 40;
  }

  // Mob com status effects — priorizar cleanse
  const hasCleanse = skill.effects.some((e) => e.type === "CLEANSE");
  if (mob.statusEffects.length > 0 && hasCleanse) {
    score += 30;
  }

  // Oponente sem counters — dano mais seguro
  if (opponent.counters.length === 0 && isDamage) {
    score += 15;
  }

  // Penalidade por accuracy baixo
  if (skill.accuracy < 100) {
    score *= skill.accuracy / 100;
  }

  // 4. Determinar categoria dominante e aplicar modificador do perfil
  const profileMods: ProfileModifiers = AI_PROFILES[profile];
  const categories: { cat: SkillCategory; active: boolean }[] = [
    { cat: "damage", active: isDamage },
    { cat: "support", active: isSupport },
    { cat: "control", active: isControl },
  ];

  const activeCategories = categories.filter((c) => c.active);

  let dominantCategory: SkillCategory;
  if (activeCategories.length === 0) {
    dominantCategory = "damage";
  } else if (activeCategories.length === 1) {
    dominantCategory = activeCategories[0].cat;
  } else {
    // Multiplas categorias: escolher a com maior modifier no perfil
    dominantCategory = activeCategories.reduce((best, curr) =>
      profileMods[curr.cat] > profileMods[best.cat] ? curr : best
    ).cat;
  }

  score *= profileMods[dominantCategory];

  // 5. Ruido aleatorio
  const noise = (randomFn ?? Math.random)() * 0.3 - 0.15;
  score *= 1 + noise;

  // 6. Retornar score
  return score;
}
