// server/stores/coop-pve-battle-store.ts — Store in-memory para batalhas coop PvE ativas (2v3/2v5)

import type { CoopPveBattleSession } from "../../lib/battle/coop-pve-types";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

const battles = new Map<string, CoopPveBattleSession>();

// ---------------------------------------------------------------------------
// Cleanup periodico de sessoes expiradas
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [battleId, session] of battles) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      cleanupSession(session);
      battles.delete(battleId);
      console.log(`[Socket.io] Coop PvE battle ${battleId} removida por TTL`);
    }
  }
}, CLEANUP_INTERVAL_MS);

function cleanupSession(session: CoopPveBattleSession): void {
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
    session.turnTimer = null;
  }
  if (session.matchTimer) {
    clearTimeout(session.matchTimer);
    session.matchTimer = null;
  }
  for (const entry of session.disconnectedPlayers.values()) {
    clearTimeout(entry.disconnectTimer);
  }
  session.disconnectedPlayers.clear();
}

// ---------------------------------------------------------------------------
// Funcoes exportadas
// ---------------------------------------------------------------------------

export function setCoopPveBattle(battleId: string, session: CoopPveBattleSession): void {
  battles.set(battleId, session);
}

export function getCoopPveBattle(battleId: string): CoopPveBattleSession | undefined {
  const session = battles.get(battleId);
  if (!session) return undefined;

  if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
    cleanupSession(session);
    battles.delete(battleId);
    return undefined;
  }

  return session;
}

export function removeCoopPveBattle(battleId: string): void {
  const session = battles.get(battleId);
  if (!session) return;

  cleanupSession(session);
  battles.delete(battleId);
}

export function getPlayerCoopPveBattle(
  userId: string
): { battleId: string; session: CoopPveBattleSession } | undefined {
  for (const [battleId, session] of battles) {
    // Check both playerSockets AND state.team (player may not be in sockets if disconnected during creation)
    const isInSockets = session.playerSockets.has(userId);
    const isInTeam = session.state.team.some((p) => p.playerId === userId);

    if (isInSockets || isInTeam) {
      if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
        cleanupSession(session);
        battles.delete(battleId);
        continue;
      }
      // Ignorar batalhas ja finalizadas (orfas aguardando TTL)
      if (session.state.status === "FINISHED") {
        continue;
      }
      return { battleId, session };
    }
  }
  return undefined;
}

export function updateCoopPvePlayerSocket(
  battleId: string,
  userId: string,
  socketId: string
): void {
  const session = battles.get(battleId);
  if (!session) return;

  if (session.playerSockets.has(userId)) {
    session.playerSockets.set(userId, socketId);
  }
}
