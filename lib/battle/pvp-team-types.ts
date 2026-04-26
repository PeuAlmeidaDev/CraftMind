// lib/battle/pvp-team-types.ts — Tipos para batalha PvP em equipe (2v2)

import type { PlayerState, TurnLogEntry, BaseStats, EquippedSkill } from "./types";

export type PvpTeamMode = "TEAM_2V2";

export type PvpTeamBattleState = {
  battleId: string;
  turnNumber: number;
  team1: PlayerState[]; // 2 jogadores
  team2: PlayerState[]; // 2 jogadores
  mode: PvpTeamMode;
  turnLog: TurnLogEntry[];
  status: "IN_PROGRESS" | "FINISHED";
  winnerTeam: 1 | 2 | null; // null = empate
};

export type PvpTeamAction = {
  playerId: string;
  skillId: string | null; // null = skip
  targetIndex?: number; // SINGLE_ENEMY: index no time inimigo (0 ou 1)
  targetId?: string; // SINGLE_ALLY: playerId do aliado
};

export type PvpTeamTurnResult = {
  state: PvpTeamBattleState;
  events: TurnLogEntry[];
};

export type PvpTeamPlayerConfig = {
  userId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
};

export type PvpTeamBattleConfig = {
  battleId: string;
  team1: PvpTeamPlayerConfig[]; // 2 players
  team2: PvpTeamPlayerConfig[]; // 2 players
  mode: PvpTeamMode;
};

export type PvpTeamBattleSession = {
  battleId: string;
  state: PvpTeamBattleState;
  playerSockets: Map<string, string>; // userId -> socketId (4 entries)
  playerNames: Map<string, string>; // userId -> name
  playerAvatars: Map<string, string | null>; // userId -> avatarUrl
  playerHouses: Map<string, string>; // userId -> houseName
  playerTeams: Map<string, 1 | 2>; // userId -> team number
  pendingActions: Map<string, PvpTeamAction>;
  turnTimer: ReturnType<typeof setTimeout> | null;
  matchAccepted: Set<string>;
  matchTimer: ReturnType<typeof setTimeout> | null;
  disconnectedPlayers: Map<
    string,
    { disconnectTimer: ReturnType<typeof setTimeout> }
  >;
  autoSkipPlayers: Set<string>; // players que desconectaram permanentemente
  lastActivityAt: number;
};
