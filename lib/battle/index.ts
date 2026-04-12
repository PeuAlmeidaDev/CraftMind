// lib/battle/index.ts — Barrel export

export { initBattle } from "./init";
export { resolveTurn } from "./turn";
export { calculateDamage, getEffectiveStat } from "./damage";
export { applyEffects } from "./effects";
export { getAvailableSkills } from "./skills";
export { isIncapacitated } from "./status";
export * from "./types";
export * from "./constants";
export { AI_PROFILES } from "./ai-profiles";
export type { AiProfile, ProfileModifiers } from "./ai-profiles";
export { scoreSkill } from "./ai-scoring";
export { chooseAction } from "./ai";
export { getPveBattle, setPveBattle, removePveBattle, hasActiveBattle } from "./pve-store";
export type { PveBattleSession } from "./pve-store";

// Coop (Boss Fight 3v1)
export * from "./coop-types";
export { chooseBossTarget, resolveCoopTargets } from "./coop-target";
export { initCoopBattle, resolveCoopTurn } from "./coop-turn";
export {
  getCoopBattle,
  setCoopBattle,
  removeCoopBattle,
  hasActiveCoopBattle,
  getCoopBattleByPlayerId,
} from "./coop-store";
export type { CoopBattleSession } from "./coop-store";
