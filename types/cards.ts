// types/cards.ts — Cristais de Memoria + Bestiario Evolutivo

import type { StatName, StatusEffect, DamageType } from "./skill";

// ---------------------------------------------------------------------------
// CardRarity (espelha o enum Prisma)
// ---------------------------------------------------------------------------

export const CardRarity = {
  COMUM: "COMUM",
  INCOMUM: "INCOMUM",
  RARO: "RARO",
  EPICO: "EPICO",
  LENDARIO: "LENDARIO",
} as const;

export type CardRarity = (typeof CardRarity)[keyof typeof CardRarity];

// ---------------------------------------------------------------------------
// CardEffect — discriminated union por `type`
// ---------------------------------------------------------------------------
//
// Fase 1: STAT_FLAT e STAT_PERCENT sao aplicados em todos os modos de batalha.
// TRIGGER e STATUS_RESIST tem schema definido mas sao INERTES em combate
// (apenas log warning em applyCardEffects). Serao ativados na Fase 2.

/** Bonus plano em um atributo do portador (ex: +5 physicalAtk) */
export type CardStatFlatEffect = {
  type: "STAT_FLAT";
  stat: StatName;
  value: number;
};

/** Bonus percentual em um atributo do portador (ex: +5% magicDef) */
export type CardStatPercentEffect = {
  type: "STAT_PERCENT";
  stat: StatName;
  /** Percentual em pontos (5 = +5%). Aplica multiplicativamente sobre (base + flat). */
  percent: number;
};

/** Trigger passivo durante a batalha (Fase 2 — inerte na Fase 1). */
export type CardTriggerEffect = {
  type: "TRIGGER";
  /** Identificador do gatilho (ex: "ON_LOW_HP", "ON_KILL"). Validado em runtime na Fase 2. */
  trigger: string;
  /** Efeito a ser disparado — schema livre nesta fase, validado na Fase 2. */
  payload: Record<string, unknown>;
};

/** Resistencia a um status especifico (Fase 2 — inerte na Fase 1). */
export type CardStatusResistEffect = {
  type: "STATUS_RESIST";
  status: StatusEffect;
  /** Percentual de reducao da chance de aplicar o status (0-100). */
  percent: number;
};

export type CardEffect =
  | CardStatFlatEffect
  | CardStatPercentEffect
  | CardTriggerEffect
  | CardStatusResistEffect;

// ---------------------------------------------------------------------------
// Mapeamento Tier do Mob -> CardRarity
// ---------------------------------------------------------------------------

export const TIER_TO_RARITY: Record<number, CardRarity> = {
  1: CardRarity.COMUM,
  2: CardRarity.INCOMUM,
  3: CardRarity.RARO,
  4: CardRarity.EPICO,
  5: CardRarity.LENDARIO,
};

/** Drop rate por tier (0-1). T1=10%, T2=5%, T3=3%, T4=1%, T5=0.5%. */
export const TIER_DROP_RATE: Record<number, number> = {
  1: 0.1,
  2: 0.05,
  3: 0.03,
  4: 0.01,
  5: 0.005,
};

// ---------------------------------------------------------------------------
// Bestiario — niveis de unlock e thresholds
// ---------------------------------------------------------------------------

export const BestiaryUnlockTier = {
  UNDISCOVERED: "UNDISCOVERED",
  DISCOVERED: "DISCOVERED",
  STUDIED: "STUDIED",
  MASTERED: "MASTERED",
} as const;

export type BestiaryUnlockTier =
  (typeof BestiaryUnlockTier)[keyof typeof BestiaryUnlockTier];

/** Thresholds de vitorias para subir de tier. */
export const BESTIARY_THRESHOLDS = {
  DISCOVERED: 1,
  STUDIED: 10,
  MASTERED: 50,
} as const;

// ---------------------------------------------------------------------------
// BestiaryEntry — payload da listagem do bestiario com gating de campos
// ---------------------------------------------------------------------------
//
// O backend ENVIA progressivamente mais campos conforme o tier de unlock:
// - UNDISCOVERED: apenas `mobId`, `unlockTier`, `victories` (= 0).
// - DISCOVERED:  + nome, tier, imageUrl, descriptionShort.
// - STUDIED:     + stats, skills (nomes), aiProfile.
// - MASTERED:    + loreExpanded, curiosity, masteryBadge: true.
// Em todos os tiers >= DISCOVERED enviamos os stats pessoais (vitorias,
// derrotas, dano total, etc.) e info do cristal (se possui + raridade).

/** Stats pessoais do user contra o mob (visiveis a partir de DISCOVERED). */
export type BestiaryPersonalStats = {
  victories: number;
  defeats: number;
  damageDealt: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

/** Info da skill do mob (exposta no tier STUDIED+). */
export type BestiaryMobSkill = {
  name: string;
  tier: number;
  damageType: DamageType;
};

export type BestiaryCardInfo = {
  hasCard: boolean;
  rarity: CardRarity | null;
  /** URL Cloudinary da arte da carta. Null se o asset ainda nao foi gerado
   * ou se o user ainda nao possui o cristal. */
  artUrl: string | null;
};

export type BestiaryEntry = {
  mobId: string;
  unlockTier: BestiaryUnlockTier;
  // sempre presentes
  victories: number;
  card: BestiaryCardInfo;
  // DISCOVERED+
  name: string | null;
  tier: number | null;
  imageUrl: string | null;
  descriptionShort: string | null;
  personalStats: BestiaryPersonalStats | null;
  // STUDIED+
  stats: {
    physicalAtk: number;
    physicalDef: number;
    magicAtk: number;
    magicDef: number;
    hp: number;
    speed: number;
  } | null;
  skills: BestiaryMobSkill[] | null;
  aiProfile: string | null;
  // MASTERED
  loreExpanded: string | null;
  curiosity: string | null;
  masteryBadge: boolean;
};

export type BestiaryTotals = {
  total: number;
  discovered: number;
  studied: number;
  mastered: number;
};

export type BestiaryResponse = {
  entries: BestiaryEntry[];
  totals: BestiaryTotals;
};
