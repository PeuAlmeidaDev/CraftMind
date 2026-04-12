// server/stores/boss-queue-store.ts — Store in-memory para fila de boss fight por categoria

import type { HabitCategory } from "@prisma/client";
import type { BaseStats, EquippedSkill } from "../../lib/battle/types";

export type BossQueueEntry = {
  userId: string;
  socketId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
  dominantCategory: HabitCategory;
  joinedAt: number;
};

const queues = new Map<HabitCategory, BossQueueEntry[]>();

export function addToBossQueue(entry: BossQueueEntry): boolean {
  if (isInBossQueue(entry.userId)) return false;

  const queue = queues.get(entry.dominantCategory) ?? [];
  queue.push(entry);
  queues.set(entry.dominantCategory, queue);
  return true;
}

export function removeFromBossQueue(userId: string): boolean {
  for (const [category, queue] of queues) {
    const index = queue.findIndex((e) => e.userId === userId);
    if (index !== -1) {
      queue.splice(index, 1);
      if (queue.length === 0) {
        queues.delete(category);
      }
      return true;
    }
  }
  return false;
}

export function isInBossQueue(userId: string): boolean {
  for (const queue of queues.values()) {
    if (queue.some((e) => e.userId === userId)) return true;
  }
  return false;
}

export function findBossMatch(category: HabitCategory): BossQueueEntry[] | null {
  const queue = queues.get(category);
  if (!queue || queue.length < 3) return null;

  const matched = queue.splice(0, 3);
  if (queue.length === 0) {
    queues.delete(category);
  }
  return matched;
}

export function getQueuePosition(userId: string): number | null {
  for (const queue of queues.values()) {
    const index = queue.findIndex((e) => e.userId === userId);
    if (index !== -1) return index + 1;
  }
  return null;
}

export function getQueueSize(category: HabitCategory): number {
  return queues.get(category)?.length ?? 0;
}
