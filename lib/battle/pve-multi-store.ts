// lib/battle/pve-multi-store.ts — Store em memoria para batalhas PvE Multi (1v3) ativas

import type { PveMultiBattleSession } from "./pve-multi-types";

const PVE_MULTI_BATTLE_TTL_MS = 30 * 60 * 1000; // 30 minutos

/** Timeout de inatividade: 1 minuto sem acao = derrota automatica */
export const INACTIVITY_TIMEOUT_MS = 60 * 1000;

/** Verifica se a sessao excedeu o tempo de inatividade (1 min) */
export function isSessionTimedOut(session: PveMultiBattleSession): boolean {
  return Date.now() - session.lastActivityAt > INACTIVITY_TIMEOUT_MS;
}

// Singleton via globalThis para sobreviver a hot-reload do Next.js em dev
const globalForMultiStore = globalThis as unknown as {
  pveMultiBattles: Map<string, PveMultiBattleSession>;
};

if (!globalForMultiStore.pveMultiBattles) {
  globalForMultiStore.pveMultiBattles = new Map<string, PveMultiBattleSession>();
}

const activeBattles = globalForMultiStore.pveMultiBattles;

// Cleanup periodico de sessoes expiradas (a cada 5 minutos)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [battleId, session] of activeBattles) {
    // TTL expirado (30 min) — limpar independente do status
    if (now - session.lastActivityAt > PVE_MULTI_BATTLE_TTL_MS) {
      activeBattles.delete(battleId);
      continue;
    }
    // Inatividade (1 min) em batalha ativa — limpeza silenciosa (sem persistir no banco)
    if (
      session.state.status === "IN_PROGRESS" &&
      now - session.lastActivityAt > INACTIVITY_TIMEOUT_MS
    ) {
      activeBattles.delete(battleId);
    }
  }
}, CLEANUP_INTERVAL_MS);

export function getMultiPveBattle(battleId: string): PveMultiBattleSession | undefined {
  const session = activeBattles.get(battleId);
  if (!session) return undefined;

  if (Date.now() - session.lastActivityAt > PVE_MULTI_BATTLE_TTL_MS) {
    activeBattles.delete(battleId);
    return undefined;
  }

  return session;
}

export function setMultiPveBattle(battleId: string, session: PveMultiBattleSession): void {
  session.lastActivityAt = Date.now();
  activeBattles.set(battleId, session);
}

export function removeMultiPveBattle(battleId: string): void {
  activeBattles.delete(battleId);
}

export function hasActiveMultiBattle(userId: string): string | null {
  const now = Date.now();
  for (const [battleId, session] of activeBattles) {
    if (now - session.lastActivityAt > PVE_MULTI_BATTLE_TTL_MS) {
      activeBattles.delete(battleId);
      continue;
    }
    if (session.userId === userId) return battleId;
  }
  return null;
}

export function getActiveMultiBattleByUser(userId: string): PveMultiBattleSession | undefined {
  const now = Date.now();
  for (const [battleId, session] of activeBattles) {
    if (now - session.lastActivityAt > PVE_MULTI_BATTLE_TTL_MS) {
      activeBattles.delete(battleId);
      continue;
    }
    if (session.userId === userId) return session;
  }
  return undefined;
}
