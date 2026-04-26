// server/stores/pvp-team-battle-store.ts — Store in-memory para batalhas PvP Team ativas

import type { PvpTeamBattleSession } from "../../lib/battle/pvp-team-types";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

const battles = new Map<string, PvpTeamBattleSession>();

// ---------------------------------------------------------------------------
// Cleanup periodico
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [battleId, session] of battles) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      cleanupSession(session);
      battles.delete(battleId);
      console.log(`[Socket.io] PvP Team battle ${battleId} removida por TTL`);
    }
  }
}, CLEANUP_INTERVAL_MS);

function cleanupSession(session: PvpTeamBattleSession): void {
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

export function setPvpTeamBattle(battleId: string, session: PvpTeamBattleSession): void {
  battles.set(battleId, session);
}

export function getPvpTeamBattle(battleId: string): PvpTeamBattleSession | undefined {
  const session = battles.get(battleId);
  if (!session) return undefined;

  if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
    cleanupSession(session);
    battles.delete(battleId);
    return undefined;
  }

  return session;
}

export function removePvpTeamBattle(battleId: string): void {
  const session = battles.get(battleId);
  if (!session) return;
  cleanupSession(session);
  battles.delete(battleId);
}

export function getPlayerPvpTeamBattle(
  userId: string
): { battleId: string; session: PvpTeamBattleSession } | undefined {
  for (const [battleId, session] of battles) {
    const isInSockets = session.playerSockets.has(userId);
    const isInTeam1 = session.state.team1.some((p) => p.playerId === userId);
    const isInTeam2 = session.state.team2.some((p) => p.playerId === userId);

    if (isInSockets || isInTeam1 || isInTeam2) {
      if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
        cleanupSession(session);
        battles.delete(battleId);
        continue;
      }
      if (session.state.status === "FINISHED") continue;
      return { battleId, session };
    }
  }
  return undefined;
}

export function updatePvpTeamPlayerSocket(
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
