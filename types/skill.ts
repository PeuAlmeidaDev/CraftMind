// types/skill.ts — Habilidades de batalha

export const DamageType = {
  PHYSICAL: "PHYSICAL",
  MAGICAL: "MAGICAL",
  NONE: "NONE",
} as const;

export type DamageType = (typeof DamageType)[keyof typeof DamageType];

export const SkillTarget = {
  SELF: "SELF",
  SINGLE_ALLY: "SINGLE_ALLY",
  ALL_ALLIES: "ALL_ALLIES",
  SINGLE_ENEMY: "SINGLE_ENEMY",
  ALL_ENEMIES: "ALL_ENEMIES",
  ALL: "ALL",
} as const;

export type SkillTarget = (typeof SkillTarget)[keyof typeof SkillTarget];

export const TaskTag = {
  PRACTICE: "PRACTICE",
  LEARN: "LEARN",
  APPLY: "APPLY",
  REFLECT: "REFLECT",
  CONNECT: "CONNECT",
} as const;

export type TaskTag = (typeof TaskTag)[keyof typeof TaskTag];

export const StatusEffect = {
  STUN: "STUN",
  FROZEN: "FROZEN",
  BURN: "BURN",
  POISON: "POISON",
  SLOW: "SLOW",
} as const;

export type StatusEffect = (typeof StatusEffect)[keyof typeof StatusEffect];

export const StatName = {
  PHYSICAL_ATK: "physicalAtk",
  PHYSICAL_DEF: "physicalDef",
  MAGIC_ATK: "magicAtk",
  MAGIC_DEF: "magicDef",
  HP: "hp",
  SPEED: "speed",
  ACCURACY: "accuracy",
} as const;

export type StatName = (typeof StatName)[keyof typeof StatName];

/**
 * Target do efeito individual (a quem o efeito se aplica dentro da resolucao).
 *
 * Alias semantico de `SkillTarget`. Existe para separar o conceito de "target da skill"
 * (a quem a skill e direcionada ao ser lancada) do "target do efeito" (a quem cada efeito
 * individual se aplica durante a resolucao). Isso permite que um efeito tenha target
 * diferente do target da skill — por exemplo, uma skill direcionada a um inimigo pode
 * ter um efeito de BUFF com target SELF.
 */
export type EffectTarget = SkillTarget;

/** Escalation de um nivel de combo */
export type ComboEscalation = {
  hits: number;
  basePower: number;
};

// ---------------------------------------------------------------------------
// Tipos base reutilizaveis (compostos nas unions abaixo)
// ---------------------------------------------------------------------------

/** Aumenta um atributo do alvo por duracao limitada */
export type BuffPayload = {
  type: "BUFF";
  target: EffectTarget;
  stat: StatName;
  value: number;
  duration: number;
  chance?: number;
};

/** Reduz um atributo do alvo por duracao limitada */
export type DebuffPayload = {
  type: "DEBUFF";
  target: EffectTarget;
  stat: StatName;
  value: number;
  duration: number;
  chance?: number;
};

/** Aplica condicao de status (stun, burn, etc.) */
export type StatusPayload = {
  type: "STATUS";
  target: EffectTarget;
  status: StatusEffect;
  chance: number;
  duration: number;
};

/** Cura percentual de HP */
export type HealPayload = {
  type: "HEAL";
  target: EffectTarget;
  percent: number;
};

/** Custo em atributo do proprio usuario */
export type SelfDebuffPayload = {
  type: "SELF_DEBUFF";
  target: EffectTarget;
  stat: StatName;
  value: number;
  duration: number;
};

/** Aumenta dano recebido de um tipo especifico */
export type VulnerabilityPayload = {
  type: "VULNERABILITY";
  target: EffectTarget;
  damageType: DamageType;
  percent: number;
  duration: number;
  chance?: number;
};

/** Dano proprio baseado no dano causado */
export type RecoilPayload = {
  type: "RECOIL";
  target: EffectTarget;
  percentOfDamage: number;
};

// ---------------------------------------------------------------------------
// Trigger do ON_EXPIRE (antigo BuffDebuffEffect)
// ---------------------------------------------------------------------------

/** Buff ou debuff monitorado que dispara o efeito ON_EXPIRE ao expirar */
export type OnExpireTrigger = BuffPayload | DebuffPayload;

// ---------------------------------------------------------------------------
// Unions compostas a partir dos tipos base
// ---------------------------------------------------------------------------

/** Efeitos que podem ser disparados quando um COUNTER e ativado (subconjunto sem recursao) */
export type CounterTriggerPayload =
  | BuffPayload
  | DebuffPayload
  | StatusPayload
  | VulnerabilityPayload
  | HealPayload
  | SelfDebuffPayload;

/** Efeitos que podem ser disparados por ON_EXPIRE (subconjunto sem recursao) */
export type OnExpirePayload =
  | BuffPayload
  | DebuffPayload
  | StatusPayload
  | HealPayload
  | RecoilPayload;

/** Efeito individual aplicado por uma habilidade (discriminated union) */
export type SkillEffect =
  | BuffPayload
  | DebuffPayload
  | StatusPayload
  | VulnerabilityPayload
  | {
      type: "PRIORITY_SHIFT";
      target: EffectTarget;
      stages: number;
      duration: number;
    }
  | {
      type: "COUNTER";
      target: EffectTarget;
      powerMultiplier: number;
      duration: number;
      onTrigger?: CounterTriggerPayload[];
    }
  | HealPayload
  | {
      type: "CLEANSE";
      target: EffectTarget;
      targets: "DEBUFFS" | "STATUS" | "ALL";
    }
  | RecoilPayload
  | SelfDebuffPayload
  | {
      type: "COMBO";
      maxStacks: number;
      escalation: ComboEscalation[];
    }
  | {
      type: "ON_EXPIRE";
      trigger: OnExpireTrigger;
      effect: OnExpirePayload;
    };

/** Configuracao de maestria da habilidade */
export type SkillMastery = {
  maxLevel?: number;
  bonusPerLevel?: number;
};

/** Habilidade completa de batalha */
export type Skill = {
  id: string;
  name: string;
  description: string;
  tier: number;
  cooldown: number; // 0 = sem cooldown, 1 = 1 turno, 2 = 2 turnos
  target: SkillTarget;
  damageType: DamageType;
  basePower: number;
  hits: number;
  accuracy: number; // 1-100, % base de acerto
  effects: SkillEffect[];
  mastery: SkillMastery;
};

/** Slot de habilidade equipada no personagem */
export type CharacterSkillSlot = {
  slotIndex: number | null;
  equipped: boolean;
  skill: Skill;
};
