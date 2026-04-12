// lib/battle/ai-profiles.ts — Perfis de IA para mobs PvE

export type AiProfile = "AGGRESSIVE" | "DEFENSIVE" | "TACTICAL" | "BALANCED";

export type ProfileModifiers = {
  damage: number;
  support: number;
  control: number;
};

export const AI_PROFILES: Record<AiProfile, ProfileModifiers> = {
  AGGRESSIVE: { damage: 1.5, support: 0.7, control: 0.8 },
  DEFENSIVE: { damage: 0.7, support: 1.5, control: 0.9 },
  TACTICAL: { damage: 0.9, support: 0.9, control: 1.5 },
  BALANCED: { damage: 1.0, support: 1.0, control: 1.0 },
};
