// server/stores/pvp-team-queue-store.ts — Store in-memory para filas de PvP Team 2v2

import type { BaseStats, EquippedSkill, Skill } from "../../lib/battle/types";

export type PvpTeamQueueEntry = {
  userId: string;
  socketId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
  /** Skill espectral elegivel para o 5o slot. Ver `lib/cards/load-equipped.ts`. */
  spectralSkill?: { skill: Skill; sourceUserCardId: string };
  joinedAt: number;
};

export type PvpTeamDuoEntry = {
  player1: PvpTeamQueueEntry;
  player2: PvpTeamQueueEntry;
  joinedAt: number;
};

// Fila solo: jogadores individuais
const soloQueue: PvpTeamQueueEntry[] = [];

// Fila de duplas: pares pre-formados
const duoQueue: PvpTeamDuoEntry[] = [];

// ---------------------------------------------------------------------------
// Solo Queue
// ---------------------------------------------------------------------------

export function addToSoloQueue(entry: PvpTeamQueueEntry): boolean {
  if (isInAnyQueue(entry.userId)) return false;
  soloQueue.push(entry);
  return true;
}

export function removeFromSoloQueue(userId: string): boolean {
  const index = soloQueue.findIndex((e) => e.userId === userId);
  if (index === -1) return false;
  soloQueue.splice(index, 1);
  return true;
}

export function findSoloMatch(): PvpTeamQueueEntry[] | null {
  if (soloQueue.length < 4) return null;
  return soloQueue.splice(0, 4);
}

export function getSoloQueuePosition(userId: string): number | null {
  const index = soloQueue.findIndex((e) => e.userId === userId);
  return index === -1 ? null : index + 1;
}

export function getSoloQueueSize(): number {
  return soloQueue.length;
}

// ---------------------------------------------------------------------------
// Duo Queue
// ---------------------------------------------------------------------------

export function addToDuoQueue(duo: PvpTeamDuoEntry): boolean {
  if (isInAnyQueue(duo.player1.userId) || isInAnyQueue(duo.player2.userId)) return false;
  duoQueue.push(duo);
  return true;
}

export function removeFromDuoQueue(userId: string): boolean {
  const index = duoQueue.findIndex(
    (d) => d.player1.userId === userId || d.player2.userId === userId
  );
  if (index === -1) return false;
  duoQueue.splice(index, 1);
  return true;
}

export function findDuoMatch(): PvpTeamDuoEntry[] | null {
  if (duoQueue.length < 2) return null;
  return duoQueue.splice(0, 2);
}

export function getDuoQueuePosition(userId: string): number | null {
  const index = duoQueue.findIndex(
    (d) => d.player1.userId === userId || d.player2.userId === userId
  );
  return index === -1 ? null : index + 1;
}

export function getDuoQueueSize(): number {
  return duoQueue.length;
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export function isInAnyQueue(userId: string): boolean {
  if (soloQueue.some((e) => e.userId === userId)) return true;
  if (duoQueue.some((d) => d.player1.userId === userId || d.player2.userId === userId)) return true;
  return false;
}

export function removeFromAnyQueue(userId: string): void {
  removeFromSoloQueue(userId);
  removeFromDuoQueue(userId);
}
