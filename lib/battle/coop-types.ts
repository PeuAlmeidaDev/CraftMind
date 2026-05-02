// lib/battle/coop-types.ts — Tipos para batalha cooperativa (Boss Fight 3v1)

import type { PlayerState, TurnLogEntry, BaseStats, EquippedSkill, Skill } from "./types";

export type CoopBattleState = {
  battleId: string;
  turnNumber: number;
  team: PlayerState[]; // 3 players
  boss: PlayerState; // boss como PlayerState
  turnLog: TurnLogEntry[];
  status: "IN_PROGRESS" | "FINISHED";
  winnerId: string | null; // null = derrota, "team" = vitoria
};

export type CoopTurnAction = {
  playerId: string;
  skillId: string | null;
  targetId?: string; // para SINGLE_ALLY
};

export type CoopTurnResult = {
  state: CoopBattleState;
  events: TurnLogEntry[];
};

export type CoopBattlePlayerConfig = {
  userId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
  /** Mesma semantica de `BattlePlayerConfig.spectralSkill` em `types.ts`. */
  spectralSkill?: { skill: Skill; sourceUserCardId: string };
};

export type CoopBossBattleConfig = {
  battleId: string;
  team: CoopBattlePlayerConfig[]; // exatamente 3
  boss: CoopBattlePlayerConfig;
};
