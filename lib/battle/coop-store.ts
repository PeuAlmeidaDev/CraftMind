// lib/battle/coop-store.ts — Store em memoria para batalhas cooperativas ativas

import type { CoopBattleState } from "./coop-types";
import type { AiProfile } from "./ai-profiles";

const COOP_BATTLE_TTL_MS = 30 * 60 * 1000; // 30 minutos

export type CoopBattleSession = {
  state: CoopBattleState;
  bossAiProfile: AiProfile;
  bossId: string;
  playerIds: string[];
  lastActivityAt: number;
};

// Singleton via globalThis para sobreviver a hot-reload do Next.js em dev
const globalForCoopStore = globalThis as unknown as {
  coopBattles: Map<string, CoopBattleSession>;
};

if (!globalForCoopStore.coopBattles) {
  globalForCoopStore.coopBattles = new Map<string, CoopBattleSession>();
}

const activeBattles = globalForCoopStore.coopBattles;

// Cleanup periodico de sessoes expiradas (a cada 5 minutos)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [battleId, session] of activeBattles) {
    if (now - session.lastActivityAt > COOP_BATTLE_TTL_MS) {
      activeBattles.delete(battleId);
    }
  }
}, CLEANUP_INTERVAL_MS);

export function getCoopBattle(battleId: string): CoopBattleSession | undefined {
  const session = activeBattles.get(battleId);
  if (!session) return undefined;

  if (Date.now() - session.lastActivityAt > COOP_BATTLE_TTL_MS) {
    activeBattles.delete(battleId);
    return undefined;
  }

  return session;
}

export function setCoopBattle(battleId: string, session: CoopBattleSession): void {
  session.lastActivityAt = Date.now();
  activeBattles.set(battleId, session);
}

export function removeCoopBattle(battleId: string): void {
  activeBattles.delete(battleId);
}

export function hasActiveCoopBattle(playerId: string): string | null {
  const now = Date.now();
  for (const [battleId, session] of activeBattles) {
    if (now - session.lastActivityAt > COOP_BATTLE_TTL_MS) {
      activeBattles.delete(battleId);
      continue;
    }
    if (session.playerIds.includes(playerId)) return battleId;
  }
  return null;
}

export function getCoopBattleByPlayerId(playerId: string): CoopBattleSession | undefined {
  const battleId = hasActiveCoopBattle(playerId);
  if (!battleId) return undefined;
  return activeBattles.get(battleId);
}
