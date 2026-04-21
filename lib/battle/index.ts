// lib/battle/index.ts — Barrel export

export { initBattle } from "./init";
export { resolveTurn } from "./turn";
export { calculateDamage, getEffectiveStat } from "./damage";
export { applyEffects } from "./effects";
export { getAvailableSkills } from "./skills";
export { isIncapacitated } from "./status";
export { isStageStat, createPlayerState, applyCounterTriggerEffects, applyOnExpireEffect, tickEntitiesEndOfTurn, resolveTargetsPvP } from "./shared-helpers";
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

// PvE Multi (1v3 / 1v5)
export * from "./pve-multi-types";
export { initMultiPveBattle, resolveMultiPveTurn } from "./pve-multi-turn";

// Coop PvE (2v3 / 2v5)
export * from "./coop-pve-types";
export { initCoopPveBattle, resolveCoopPveTurn } from "./coop-pve-turn";
