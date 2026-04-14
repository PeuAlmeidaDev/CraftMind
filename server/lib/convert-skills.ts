// server/lib/convert-skills.ts — Helper para converter resultado Prisma em EquippedSkill[]

import type { BaseStats, EquippedSkill } from "../../lib/battle/types";
import type { Skill, SkillTarget, DamageType, SkillMastery } from "../../types/skill";

/** Tipo esperado do resultado de characterSkills do Prisma com select padrao */
type PrismaCharacterSkillRow = {
  slotIndex: number | null;
  skill: {
    id: string;
    name: string;
    description: string;
    tier: number;
    cooldown: number;
    target: string;
    damageType: string;
    basePower: number;
    hits: number;
    accuracy: number;
    effects: unknown;
    mastery: unknown;
  };
};

/** Tipo esperado do character do Prisma com stats */
type PrismaCharacterWithStats = {
  id: string;
  physicalAtk: number;
  physicalDef: number;
  magicAtk: number;
  magicDef: number;
  hp: number;
  speed: number;
};

/** Converte array de characterSkills do Prisma em EquippedSkill[] tipado */
export function convertToEquippedSkills(
  rows: PrismaCharacterSkillRow[]
): EquippedSkill[] {
  return rows.map((cs) => ({
    skillId: cs.skill.id,
    slotIndex: cs.slotIndex as number,
    skill: {
      id: cs.skill.id,
      name: cs.skill.name,
      description: cs.skill.description,
      tier: cs.skill.tier,
      cooldown: cs.skill.cooldown,
      target: cs.skill.target as SkillTarget,
      damageType: cs.skill.damageType as DamageType,
      basePower: cs.skill.basePower,
      hits: cs.skill.hits,
      accuracy: cs.skill.accuracy,
      effects: cs.skill.effects as Skill["effects"],
      mastery: cs.skill.mastery as SkillMastery,
    },
  }));
}

/** Extrai BaseStats de um character do Prisma */
export function extractBaseStats(character: PrismaCharacterWithStats): BaseStats {
  return {
    physicalAtk: character.physicalAtk,
    physicalDef: character.physicalDef,
    magicAtk: character.magicAtk,
    magicDef: character.magicDef,
    hp: character.hp,
    speed: character.speed,
  };
}

/** Select padrao para characterSkills no Prisma */
export const CHARACTER_SKILLS_SELECT = {
  where: { equipped: true },
  orderBy: { slotIndex: "asc" as const },
  select: {
    slotIndex: true,
    skill: {
      select: {
        id: true,
        name: true,
        description: true,
        tier: true,
        cooldown: true,
        target: true,
        damageType: true,
        basePower: true,
        hits: true,
        accuracy: true,
        effects: true,
        mastery: true,
      },
    },
  },
} as const;
