// lib/battle/coop-pve-types.ts — Tipos para batalha cooperativa PvE (2v3 / 2v5)

import type { PlayerState, TurnLogEntry, BaseStats, EquippedSkill } from "./types";
import type { MobState } from "./pve-multi-types";
import type { AiProfile } from "./ai-profiles";

export type CoopPveMode = "2v3" | "2v5";

export type CoopPveBattleState = {
  battleId: string;
  turnNumber: number;
  team: PlayerState[];     // exatamente 2 players
  mobs: MobState[];        // 3 ou 5 mobs
  mode: CoopPveMode;
  status: "IN_PROGRESS" | "FINISHED";
  result: "PENDING" | "VICTORY" | "DEFEAT";
  turnLog: TurnLogEntry[];
};

export type CoopPveAction = {
  playerId: string;
  skillId: string | null;
  targetIndex?: number;    // SINGLE_ENEMY (qual mob, 0 a mobs.length-1)
  targetId?: string;       // SINGLE_ALLY (qual aliado curar/buffar)
};

export type CoopPveTurnResult = {
  state: CoopPveBattleState;
  events: TurnLogEntry[];
};

export type CoopPvePlayerConfig = {
  userId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
};

export type CoopPveMobConfig = {
  mobId: string;
  name: string;
  tier: number;
  aiProfile: AiProfile;
  stats: BaseStats;
  skills: EquippedSkill[];
  imageUrl?: string | null;
};

export type CoopPveBattleConfig = {
  battleId: string;
  team: CoopPvePlayerConfig[];  // exatamente 2
  mobs: CoopPveMobConfig[];     // 3 ou 5
  mode: CoopPveMode;
};

export type CoopPveBattleSession = {
  battleId: string;
  state: CoopPveBattleState;
  mobConfigs: CoopPveMobConfig[];
  playerSockets: Map<string, string>;
  playerNames: Map<string, string>;
  playerAvatars: Map<string, string | null>;
  playerHouses: Map<string, string>;
  pendingActions: Map<string, CoopPveAction>;
  turnTimer: ReturnType<typeof setTimeout> | null;
  matchAccepted: Set<string>;
  matchTimer: ReturnType<typeof setTimeout> | null;
  disconnectedPlayers: Map<string, { disconnectTimer: ReturnType<typeof setTimeout> }>;
  lastActivityAt: number;
};
