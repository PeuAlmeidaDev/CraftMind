// server/stores/coop-pve-queue-store.ts — Store in-memory para fila de batalha coop PvE (2v3/2v5/3v5)

import type { BaseStats, EquippedSkill, Skill } from "../../lib/battle/types";
import type { CoopPveMode } from "../../lib/battle/coop-pve-types";

export type CoopPveQueueEntry = {
  userId: string;
  socketId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
  /** Skill espectral elegivel para o 5o slot. Ver `lib/cards/load-equipped.ts`. */
  spectralSkill?: { skill: Skill; sourceUserCardId: string };
  mode: CoopPveMode;
  joinedAt: number;
};

const queues = new Map<CoopPveMode, CoopPveQueueEntry[]>();

export function addToCoopPveQueue(entry: CoopPveQueueEntry): boolean {
  if (isInCoopPveQueue(entry.userId)) return false;

  const queue = queues.get(entry.mode) ?? [];
  queue.push(entry);
  queues.set(entry.mode, queue);
  return true;
}

export function removeFromCoopPveQueue(userId: string): boolean {
  for (const [mode, queue] of queues) {
    const index = queue.findIndex((e) => e.userId === userId);
    if (index !== -1) {
      queue.splice(index, 1);
      if (queue.length === 0) {
        queues.delete(mode);
      }
      return true;
    }
  }
  return false;
}

export function isInCoopPveQueue(userId: string): boolean {
  for (const queue of queues.values()) {
    if (queue.some((e) => e.userId === userId)) return true;
  }
  return false;
}

export function findCoopPveMatch(mode: CoopPveMode): CoopPveQueueEntry[] | null {
  const queue = queues.get(mode);
  const requiredPlayers = mode === "3v5" ? 3 : 2;
  if (!queue || queue.length < requiredPlayers) return null;

  const matched = queue.splice(0, requiredPlayers);
  if (queue.length === 0) {
    queues.delete(mode);
  }
  return matched;
}

export function getCoopPveQueuePosition(userId: string): number | null {
  for (const queue of queues.values()) {
    const index = queue.findIndex((e) => e.userId === userId);
    if (index !== -1) return index + 1;
  }
  return null;
}

export function getCoopPveQueueSize(mode: CoopPveMode): number {
  return queues.get(mode)?.length ?? 0;
}
