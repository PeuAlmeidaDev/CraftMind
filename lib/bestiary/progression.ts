// lib/bestiary/progression.ts — Progressao do bestiario evolutivo.
//
// `getUnlockTier(victories)` mapeia o numero de vitorias contra o mob para um
// dos 4 niveis de unlock: UNDISCOVERED (0), DISCOVERED (>=1), STUDIED (>=10),
// MASTERED (>=50).
//
// `buildBestiaryEntry(...)` constroi o payload com gating de campos pelo tier.
// O backend NUNCA envia campos sensiveis para um tier inferior — esse e o ponto
// unico de verdade para "o que o usuario pode ver" sobre cada mob.

import type {
  BestiaryEntry,
  BestiaryUnlockTier,
  BestiaryMobSkill,
  CardRarity,
} from "@/types/cards";
import {
  BestiaryUnlockTier as BestiaryUnlockTierEnum,
  BESTIARY_THRESHOLDS,
} from "@/types/cards";
import type { DamageType } from "@/types/skill";

export function getUnlockTier(victories: number): BestiaryUnlockTier {
  if (victories >= BESTIARY_THRESHOLDS.MASTERED) {
    return BestiaryUnlockTierEnum.MASTERED;
  }
  if (victories >= BESTIARY_THRESHOLDS.STUDIED) {
    return BestiaryUnlockTierEnum.STUDIED;
  }
  if (victories >= BESTIARY_THRESHOLDS.DISCOVERED) {
    return BestiaryUnlockTierEnum.DISCOVERED;
  }
  return BestiaryUnlockTierEnum.UNDISCOVERED;
}

/**
 * Forma minima dos dados que o builder precisa do `Mob` (todos opcionais a
 * partir do tier STUDIED ou MASTERED — abaixo disso podem vir faltando).
 */
export type BestiaryMobInput = {
  id: string;
  name: string;
  description: string;
  tier: number;
  aiProfile: string;
  imageUrl: string | null;
  loreExpanded: string | null;
  curiosity: string | null;
  physicalAtk: number;
  physicalDef: number;
  magicAtk: number;
  magicDef: number;
  hp: number;
  speed: number;
  skills: ReadonlyArray<{ name: string; tier: number; damageType: string }>;
};

export type BestiaryKillStatInput = {
  victories: number;
  defeats: number;
  damageDealt: number;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
};

export type BuildBestiaryEntryInput = {
  mob: BestiaryMobInput;
  killStat: BestiaryKillStatInput | null;
  hasCard: boolean;
  cardRarity: CardRarity | null;
  /** URL da arte da carta. Sera enviada ao cliente apenas se hasCard=true. */
  cardArtUrl: string | null;
};

export function buildBestiaryEntry({
  mob,
  killStat,
  hasCard,
  cardRarity,
  cardArtUrl,
}: BuildBestiaryEntryInput): BestiaryEntry {
  const victories = killStat?.victories ?? 0;
  const unlockTier = getUnlockTier(victories);

  // Base — sempre presente.
  // artUrl so eh exposto se o usuario possui o cristal (espelha gating de hasCard).
  const entry: BestiaryEntry = {
    mobId: mob.id,
    unlockTier,
    victories,
    card: {
      hasCard,
      rarity: cardRarity,
      artUrl: hasCard ? cardArtUrl : null,
    },
    name: null,
    tier: null,
    imageUrl: null,
    descriptionShort: null,
    personalStats: null,
    stats: null,
    skills: null,
    aiProfile: null,
    loreExpanded: null,
    curiosity: null,
    masteryBadge: false,
  };

  if (unlockTier === BestiaryUnlockTierEnum.UNDISCOVERED) {
    return entry;
  }

  // DISCOVERED+
  entry.name = mob.name;
  entry.tier = mob.tier;
  entry.imageUrl = mob.imageUrl;
  entry.descriptionShort = mob.description;
  entry.personalStats = {
    victories,
    defeats: killStat?.defeats ?? 0,
    damageDealt: killStat?.damageDealt ?? 0,
    firstSeenAt: killStat?.firstSeenAt ? killStat.firstSeenAt.toISOString() : null,
    lastSeenAt: killStat?.lastSeenAt ? killStat.lastSeenAt.toISOString() : null,
  };

  if (
    unlockTier === BestiaryUnlockTierEnum.STUDIED ||
    unlockTier === BestiaryUnlockTierEnum.MASTERED
  ) {
    entry.stats = {
      physicalAtk: mob.physicalAtk,
      physicalDef: mob.physicalDef,
      magicAtk: mob.magicAtk,
      magicDef: mob.magicDef,
      hp: mob.hp,
      speed: mob.speed,
    };
    entry.skills = mob.skills.map(
      (s): BestiaryMobSkill => ({
        name: s.name,
        tier: s.tier,
        damageType: s.damageType as DamageType,
      }),
    );
    entry.aiProfile = mob.aiProfile;
  }

  if (unlockTier === BestiaryUnlockTierEnum.MASTERED) {
    entry.loreExpanded = mob.loreExpanded;
    entry.curiosity = mob.curiosity;
    entry.masteryBadge = true;
  }

  return entry;
}
