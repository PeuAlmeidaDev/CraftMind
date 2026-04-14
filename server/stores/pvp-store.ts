// server/stores/pvp-store.ts — Store in-memory para batalhas PvP ativas

import type { BattleState, TurnAction } from "../../lib/battle/types";

export type PvpBattleSession = {
  state: BattleState;
  player1SocketId: string;
  player2SocketId: string;
  pendingActions: Map<string, TurnAction>;
  turnTimer: ReturnType<typeof setTimeout> | null;
  disconnectedPlayer: {
    playerId: string;
    disconnectTimer: ReturnType<typeof setTimeout>;
  } | null;
};

const battles = new Map<string, PvpBattleSession>();

export function getPvpBattle(battleId: string): PvpBattleSession | undefined {
  return battles.get(battleId);
}

export function setPvpBattle(battleId: string, session: PvpBattleSession): void {
  battles.set(battleId, session);
}

export function removePvpBattle(battleId: string): void {
  const session = battles.get(battleId);
  if (!session) return;

  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
  }
  if (session.disconnectedPlayer) {
    clearTimeout(session.disconnectedPlayer.disconnectTimer);
  }
  battles.delete(battleId);
}

export function getPlayerBattle(
  userId: string
): { battleId: string; session: PvpBattleSession } | undefined {
  for (const [battleId, session] of battles) {
    const isPlayer =
      session.state.players[0].playerId === userId ||
      session.state.players[1].playerId === userId;
    if (isPlayer) {
      return { battleId, session };
    }
  }
  return undefined;
}

export function updatePlayerSocket(
  battleId: string,
  playerId: string,
  newSocketId: string
): void {
  const session = battles.get(battleId);
  if (!session) return;

  if (session.state.players[0].playerId === playerId) {
    session.player1SocketId = newSocketId;
  } else if (session.state.players[1].playerId === playerId) {
    session.player2SocketId = newSocketId;
  }
}
