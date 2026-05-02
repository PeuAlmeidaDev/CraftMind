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
// UserCardSummary — payload retornado por GET /api/cards
// ---------------------------------------------------------------------------
//
// Forma compartilhada entre API e componentes da tela /character (CardSlots,
// CardPickerModal). Inclui `purity` (0-100, baseline 50 = 1.0x).

export type UserCardSummary = {
  id: string;
  equipped: boolean;
  slotIndex: number | null;
  xp: number;
  level: number;
  /** Purity 0-100 (baseline 50). 100 marca um Cristal Espectral. */
  purity: number;
  /** Skill espectral escolhida (5o slot em batalha). So tem efeito quando
   *  purity === 100. Null/undefined se nao definida ainda. */
  spectralSkillId?: string | null;
  /** ISO 8601 — data em que o UserCard foi criado (drop). Opcional para
   *  manter compat com chamadas antigas; populado por GET /api/cards. */
  createdAt?: string;
  card: {
    id: string;
    name: string;
    flavorText: string;
    rarity: CardRarity;
    effects: CardEffect[];
    /** Percentual individual de drop quando a variante e elegivel (0-100).
     *  Opcional para compat. Populado por GET /api/cards. */
    dropChance?: number;
    /** Arte padrao (Cloudinary). Null enquanto asset nao foi gerado. */
    cardArtUrl?: string | null;
    /** Arte alternativa exclusiva da versao Espectral (purity === 100).
     *  Null => frontend faz fallback para `cardArtUrl` com filtro CSS holografico. */
    cardArtUrlSpectral?: string | null;
    mob: {
      id: string;
      name: string;
      tier: number;
      imageUrl: string | null;
    };
  };
};

// ---------------------------------------------------------------------------
// PendingCardDuplicate — drop de duplicata aguardando decisao
// ---------------------------------------------------------------------------
//
// Retornado por GET /api/cards/pending-duplicates. O jogador resolve via
// POST /api/cards/pending-duplicates/[id]/resolve com decision REPLACE ou CONVERT.

export type PendingDuplicateDecision = "REPLACE" | "CONVERT";

export type PendingCardDuplicateSummary = {
  id: string;
  newPurity: number;
  createdAt: string;
  userCard: {
    id: string;
    xp: number;
    level: number;
    purity: number;
    card: {
      id: string;
      name: string;
      flavorText: string;
      rarity: CardRarity;
      mob: {
        id: string;
        name: string;
        tier: number;
        imageUrl: string | null;
      };
    };
  };
};

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

/**
 * Info de uma variante de cristal (1, 2 ou 3 estrelas) de um mob no bestiario.
 *
 * - `cardArtUrl` e exposto desde o SEEN (o user ja viu o mob — faz sentido
 *   ver a arte da variante, mesmo sem ter coletado).
 * - `flavorText` so e exposto quando `hasCard === true` (estilo Pokedex —
 *   gera curiosidade e premia a coleta).
 * - `userCardXp` e `userCardLevel` sao expostos quando `hasCard === true`
 *   (refletem o progresso da copia do usuario nesta variante) e ficam
 *   `null` caso contrario.
 */
export type BestiaryCardInfo = {
  id: string;
  name: string;
  rarity: CardRarity;
  /** Estrelas minimas de encontro para esta variante cair (1, 2 ou 3). */
  requiredStars: number;
  /** Percentual individual de drop quando a variante e elegivel (0-100). */
  dropChance: number;
  /** O usuario possui esta variante? */
  hasCard: boolean;
  /** URL Cloudinary da arte. Null se o asset ainda nao foi gerado. */
  cardArtUrl: string | null;
  /** Arte alternativa exclusiva da versao Espectral. Null => fallback CSS. */
  cardArtUrlSpectral: string | null;
  /** Texto de lore da carta — null quando `hasCard === false`. */
  flavorText: string | null;
  /** XP acumulado na copia do user. Null quando hasCard === false. */
  userCardXp: number | null;
  /** Level da copia do user (1-5). Null quando hasCard === false. */
  userCardLevel: number | null;
  /** Purity 0-100 da copia do user (50 = baseline). Null quando hasCard === false. */
  userCardPurity: number | null;
};

export type BestiaryEntry = {
  mobId: string;
  unlockTier: BestiaryUnlockTier;
  // sempre presentes
  victories: number;
  /** Variantes de cristal cadastradas para este mob, ordenadas por
   * `requiredStars` ascendente. Pode ser array vazio se nenhuma variante
   * foi cadastrada. */
  cards: BestiaryCardInfo[];
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

// ---------------------------------------------------------------------------
// Spectral Drop — broadcast global e showcase publica
// ---------------------------------------------------------------------------

/**
 * Payload do evento Socket.io `global:spectral-drop` emitido para todos os
 * sockets conectados quando alguem dropa um Cristal Espectral (purity === 100).
 *
 * O cliente filtra eventos onde `userId === currentUserId` para nao mostrar
 * o toast pro proprio dropper (que ja viu via CardDropReveal).
 */
export type SpectralDropBroadcast = {
  /** ID do usuario que dropou (usado para filtro client-side). */
  userId: string;
  /** Nome de exibicao do dropper. */
  userName: string;
  /** Nome da carta (Card.name). */
  cardName: string;
  /** Nome do mob de origem. */
  mobName: string;
};

/** Resposta de GET /api/user/[id]/showcase. */
export type ShowcaseResponse = {
  /** IDs dos UserCards na ordem definida pelo dono. */
  userCardIds: string[];
  /** UserCards completos prontos para render. */
  cards: UserCardSummary[];
};
