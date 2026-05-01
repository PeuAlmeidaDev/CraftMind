// lib/battle/pve-store.ts — Store em memoria para batalhas PvE ativas

import type { BattleState } from "./types";
import type { AiProfile } from "./ai-profiles";
import type { EncounterStars } from "@/lib/mobs/encounter-stars";

const PVE_BATTLE_TTL_MS = 30 * 60 * 1000; // 30 minutos
export const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 1 minuto

export type PveBattleSession = {
  state: BattleState;
  mobProfile: AiProfile;
  mobId: string;
  userId: string;
  lastActivityAt: number;
  // Dados do mob para reconexao (evita re-fetch do banco)
  mobName: string;
  mobTier: number;
  mobImageUrl: string | null;
  mobDescription: string;
  // Estrela do encontro: define multiplicador de stats e cartas elegiveis ao drop
  encounterStars: EncounterStars;
};

// Singleton via globalThis para sobreviver a hot-reload do Next.js em dev
const globalForPveStore = globalThis as unknown as {
  pveBattles: Map<string, PveBattleSession>;
};

if (!globalForPveStore.pveBattles) {
  globalForPveStore.pveBattles = new Map<string, PveBattleSession>();
}

const activeBattles = globalForPveStore.pveBattles;

// Cleanup periodico de sessoes expiradas (a cada 5 minutos)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [battleId, session] of activeBattles) {
    if (now - session.lastActivityAt > PVE_BATTLE_TTL_MS) {
      activeBattles.delete(battleId);
      continue;
    }
    if (
      session.state.status === "IN_PROGRESS" &&
      now - session.lastActivityAt > INACTIVITY_TIMEOUT_MS
    ) {
      activeBattles.delete(battleId);
    }
  }
}, CLEANUP_INTERVAL_MS);

export function isSessionTimedOut(session: PveBattleSession): boolean {
  return Date.now() - session.lastActivityAt > INACTIVITY_TIMEOUT_MS;
}

export function getPveBattle(battleId: string): PveBattleSession | undefined {
  const session = activeBattles.get(battleId);
  if (!session) return undefined;

  if (Date.now() - session.lastActivityAt > PVE_BATTLE_TTL_MS) {
    activeBattles.delete(battleId);
    return undefined;
  }

  return session;
}

export function setPveBattle(battleId: string, session: PveBattleSession): void {
  session.lastActivityAt = Date.now();
  activeBattles.set(battleId, session);
}

export function removePveBattle(battleId: string): void {
  activeBattles.delete(battleId);
}

export function hasActiveBattle(userId: string): string | null {
  const now = Date.now();
  for (const [battleId, session] of activeBattles) {
    if (now - session.lastActivityAt > PVE_BATTLE_TTL_MS) {
      activeBattles.delete(battleId);
      continue;
    }
    if (session.userId === userId) return battleId;
  }
  return null;
}

export function getActiveBattleByUser(userId: string): PveBattleSession | undefined {
  const now = Date.now();
  for (const [battleId, session] of activeBattles) {
    if (now - session.lastActivityAt > PVE_BATTLE_TTL_MS) {
      activeBattles.delete(battleId);
      continue;
    }
    if (session.userId === userId) return session;
  }
  return undefined;
}
