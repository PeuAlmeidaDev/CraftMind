// server/stores/queue-store.ts — Store in-memory para fila de matchmaking

import type { BaseStats, EquippedSkill } from "../../lib/battle/types";

export type QueueEntry = {
  userId: string;
  socketId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
  joinedAt: number;
};

const queue = new Map<string, QueueEntry>();

export function addToQueue(entry: QueueEntry): void {
  queue.set(entry.userId, entry);
}

export function removeFromQueue(userId: string): boolean {
  return queue.delete(userId);
}

export function findMatch(userId: string): QueueEntry | null {
  for (const [key, entry] of queue) {
    if (key !== userId) {
      queue.delete(key);
      return entry;
    }
  }
  return null;
}

export function getQueueSize(): number {
  return queue.size;
}

export function isInQueue(userId: string): boolean {
  return queue.has(userId);
}
