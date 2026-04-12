// server/stores/boss-battle-store.ts — Store in-memory para batalhas coop ativas

import type { HabitCategory } from "@prisma/client";
import type { CoopBattleState, CoopTurnAction } from "../../lib/battle/coop-types";

export type BossBattleSession = {
  battleId: string;
  bossId: string;
  bossName: string;
  bossTier: number;
  bossAiProfile: string;
  state: CoopBattleState;
  playerSockets: Map<string, string>; // userId -> socketId
  playerCategories: Map<string, HabitCategory>; // userId -> dominantCategory
  playerNames: Map<string, string>; // userId -> display name
  pendingActions: Map<string, CoopTurnAction>;
  turnTimer: ReturnType<typeof setTimeout> | null;
  matchAccepted: Set<string>;
  matchTimer: ReturnType<typeof setTimeout> | null;
  disconnectedPlayers: Map<string, { disconnectTimer: ReturnType<typeof setTimeout> }>;
  lastActivityAt: number;
};

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

const battles = new Map<string, BossBattleSession>();

// ---------------------------------------------------------------------------
// Cleanup periodico de sessoes expiradas
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [battleId, session] of battles) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      cleanupSession(session);
      battles.delete(battleId);
      console.log(`[Socket.io] Boss battle ${battleId} removida por TTL`);
    }
  }
}, CLEANUP_INTERVAL_MS);

function cleanupSession(session: BossBattleSession): void {
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

export function setBossBattle(battleId: string, session: BossBattleSession): void {
  battles.set(battleId, session);
}

export function getBossBattle(battleId: string): BossBattleSession | undefined {
  const session = battles.get(battleId);
  if (!session) return undefined;

  if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
    cleanupSession(session);
    battles.delete(battleId);
    return undefined;
  }

  return session;
}

export function removeBossBattle(battleId: string): void {
  const session = battles.get(battleId);
  if (!session) return;

  cleanupSession(session);
  battles.delete(battleId);
}

export function getPlayerBossBattle(
  userId: string
): { battleId: string; session: BossBattleSession } | undefined {
  for (const [battleId, session] of battles) {
    if (session.playerSockets.has(userId)) {
      if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
        cleanupSession(session);
        battles.delete(battleId);
        continue;
      }
      return { battleId, session };
    }
  }
  return undefined;
}

export function updateBossPlayerSocket(
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
