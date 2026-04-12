// lib/battle/constants.ts — Constantes puras da engine de combate

export const STAGE_MULTIPLIERS: Record<number, number> = {
  [-4]: 0.40,
  [-3]: 0.50,
  [-2]: 0.65,
  [-1]: 0.80,
  [0]: 1.00,
  [1]: 1.25,
  [2]: 1.50,
  [3]: 1.75,
  [4]: 2.00,
} as const;

export const MIN_STAGE = -4;
export const MAX_STAGE = 4;
export const MIN_DAMAGE = 1;

/** Dano por turno de POISON baseado em turnsElapsed (0, 1, 2+) */
export const POISON_SCALING: [number, number, number] = [0.04, 0.06, 0.08];

export const BURN_DAMAGE_PERCENT = 0.06;
export const FROZEN_PHYSICAL_VULN = 0.30;
export const RANDOM_MIN = 0.90;
export const RANDOM_MAX = 1.10;
export const MAX_TURNS = 50;
