// types/ranking.ts — Tipos compartilhados do sistema de rankings

import type { HouseName } from "./house";

// ---------------------------------------------------------------------------
// House filter / season
// ---------------------------------------------------------------------------

/**
 * Filtro de casa para os rankings individuais.
 * "GLOBAL" inclui todos os jogadores (com ou sem casa).
 */
export const HouseFilter = {
  GLOBAL: "GLOBAL",
  ARION: "ARION",
  LYCUS: "LYCUS",
  NOCTIS: "NOCTIS",
  NEREID: "NEREID",
} as const;
export type HouseFilter = (typeof HouseFilter)[keyof typeof HouseFilter];

/**
 * Periodos do Estandarte das Casas.
 * - lifetime: sem filtro de data
 * - monthly:  ultimos 30 dias
 * - weekly:   ultimos 7 dias
 */
export const RankingSeason = {
  LIFETIME: "lifetime",
  MONTHLY: "monthly",
  WEEKLY: "weekly",
} as const;
export type RankingSeason = (typeof RankingSeason)[keyof typeof RankingSeason];

// ---------------------------------------------------------------------------
// Tipos das entradas individuais
// ---------------------------------------------------------------------------

/** Campos comuns a todas as entradas de ranking individual. */
export type RankingBaseEntry = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  house: HouseName | null;
  level: number;
};

/** Entrada do ranking PvP (1v1 ou Team 2v2). */
export type RankingPvpEntry = RankingBaseEntry & {
  rankingPoints: number;
  wins: number;
  losses: number;
  draws: number;
};

/** Entrada do ranking de Level/EXP. */
export type RankingLevelEntry = RankingBaseEntry & {
  currentExp: number;
};

/** Entrada do ranking de habitos completados (lifetime). */
export type RankingHabitsEntry = RankingBaseEntry & {
  habitCount: number;
};

// ---------------------------------------------------------------------------
// Estandarte das Casas
// ---------------------------------------------------------------------------

/** Entrada do Estandarte das Casas (sempre 4: ARION/LYCUS/NOCTIS/NEREID). */
export type HouseStandardEntry = {
  rank: number;
  house: HouseName;
  animal: string;
  /** Pontuacao per capita (Σ pontos / max(membersCount, 1)). */
  score: number;
  /** Total de eventos contabilizados no periodo (tiebreak). */
  totalEvents: number;
  /** Quantidade de jogadores da casa no momento do calculo. */
  membersCount: number;
};
