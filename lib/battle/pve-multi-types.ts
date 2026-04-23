// lib/battle/pve-multi-types.ts — Tipos para batalha PvE Multi (1v3 / 1v5)

import type { PlayerState, TurnLogEntry } from "./types";
import type { AiProfile } from "./ai-profiles";

export type PveMultiMode = "1v3" | "1v5";

export type MobState = PlayerState & {
  mobId: string;
  profile: AiProfile;
  defeated: boolean;
};

export type PveMultiBattleState = {
  battleId: string;
  player: PlayerState;
  mobs: MobState[];
  mode: PveMultiMode;
  turnNumber: number;
  status: "IN_PROGRESS" | "FINISHED";
  result: "PENDING" | "VICTORY" | "DEFEAT";
  turnLog: TurnLogEntry[];
};

export type PveMultiAction = {
  skillId: string | null;
  targetIndex?: number; // 0 a mobs.length-1, obrigatorio para skills com target SINGLE_ENEMY
};

export type PveMultiTurnResult = {
  state: PveMultiBattleState;
  events: TurnLogEntry[];
};

export type MobDisplayInfo = {
  name: string;
  tier: number;
  imageUrl: string | null;
};

export type PveMultiBattleSession = {
  state: PveMultiBattleState;
  userId: string;
  lastActivityAt: number;
  mobsInfo: MobDisplayInfo[];
};
