// lib/battle/pve-multi-types.ts — Tipos para batalha PvE Multi (1v3)

import type { PlayerState, TurnLogEntry } from "./types";
import type { AiProfile } from "./ai-profiles";

export type MobState = PlayerState & {
  mobId: string;
  profile: AiProfile;
  defeated: boolean;
};

export type PveMultiBattleState = {
  battleId: string;
  player: PlayerState;
  mobs: [MobState, MobState, MobState];
  turnNumber: number;
  status: "IN_PROGRESS" | "FINISHED";
  result: "PENDING" | "VICTORY" | "DEFEAT";
  turnLog: TurnLogEntry[];
};

export type PveMultiAction = {
  skillId: string | null;
  targetIndex?: number; // 0-2, obrigatorio para skills com target SINGLE_ENEMY
};

export type PveMultiTurnResult = {
  state: PveMultiBattleState;
  events: TurnLogEntry[];
};

export type PveMultiBattleSession = {
  state: PveMultiBattleState;
  userId: string;
  lastActivityAt: number;
};
