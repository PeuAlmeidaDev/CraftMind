// server/handlers/battle.ts — Handlers de batalha PvP em tempo real

import type { Server, Socket } from "socket.io";
import type { TurnAction, BattleState, PlayerState } from "../../lib/battle/types";
import { resolveTurn } from "../../lib/battle/turn";
import { calculatePvpExpGained } from "../../lib/exp/formulas";
import { processLevelUp } from "../../lib/exp/level-up";
import {
  getPvpBattle,
  removePvpBattle,
  getPlayerBattle,
  updatePlayerSocket,
} from "../stores/pvp-store";
import type { PvpBattleSession } from "../stores/pvp-store";
import { prisma } from "../lib/prisma";

const TURN_TIMEOUT_MS = 30_000;
const RECONNECT_GRACE_MS = 30_000;

// Ranking points para PvP 1v1
const RANKING_1V1_WIN = 30;
const RANKING_1V1_LOSS = -20;
const RANKING_1V1_DRAW = 5;

// ---------------------------------------------------------------------------
// Tipo auxiliar para estado sanitizado enviado ao jogador
// ---------------------------------------------------------------------------

type SanitizedPlayerState = Pick<
  PlayerState,
  "playerId" | "characterId" | "baseStats" | "currentHp" | "statusEffects"
>;

type SanitizedBattleState = Omit<BattleState, "players"> & {
  players: [PlayerState | SanitizedPlayerState, PlayerState | SanitizedPlayerState];
};

// ---------------------------------------------------------------------------
// Sanitizar estado para um jogador especifico (funcao pura)
// ---------------------------------------------------------------------------

export function sanitizeStateForPlayer(
  state: BattleState,
  playerId: string
): SanitizedBattleState {
  const sanitizedPlayers = state.players.map((player) => {
    if (player.playerId === playerId) {
      // Dados completos para o proprio jogador (copia rasa suficiente — valores sao primitivos ou arrays imutaveis no contexto de leitura)
      return { ...player };
    }
    // Dados limitados do oponente
    const sanitized: SanitizedPlayerState = {
      playerId: player.playerId,
      characterId: player.characterId,
      baseStats: { ...player.baseStats },
      currentHp: player.currentHp,
      statusEffects: [...player.statusEffects],
    };
    return sanitized;
  }) as [PlayerState | SanitizedPlayerState, PlayerState | SanitizedPlayerState];

  return {
    battleId: state.battleId,
    turnNumber: state.turnNumber,
    players: sanitizedPlayers,
    turnLog: [...state.turnLog],
    status: state.status,
    winnerId: state.winnerId,
  };
}

// ---------------------------------------------------------------------------
// Persistir resultado da batalha no banco (fire-and-forget)
// ---------------------------------------------------------------------------

async function persistBattleResult(
  battleId: string,
  state: BattleState
): Promise<void> {
  const player1Id = state.players[0].playerId;
  const player2Id = state.players[1].playerId;
  const winnerId = state.winnerId;

  await prisma.battle.update({
    where: { id: battleId },
    data: {
      status: "FINISHED",
      winnerId,
      log: state.turnLog as object[],
    },
  });

  await prisma.$transaction(async (tx) => {
    const [char1, char2] = await Promise.all([
      tx.character.findUnique({ where: { userId: player1Id } }),
      tx.character.findUnique({ where: { userId: player2Id } }),
    ]);

    if (!char1 || !char2) {
      console.log(
        `[Socket.io] Character nao encontrado para persistencia da batalha ${battleId}`
      );
      return;
    }

    const getResult = (
      playerId: string
    ): "VICTORY" | "DEFEAT" | "DRAW" => {
      if (!winnerId) return "DRAW";
      return playerId === winnerId ? "VICTORY" : "DEFEAT";
    };

    const exp1 = calculatePvpExpGained(getResult(player1Id), char1.level, char2.level);
    const exp2 = calculatePvpExpGained(getResult(player2Id), char2.level, char1.level);

    const updates: Promise<unknown>[] = [];

    if (exp1 > 0) {
      const levelResult = processLevelUp({
        level: char1.level,
        currentExp: char1.currentExp + exp1,
        freePoints: char1.freePoints,
      });
      updates.push(
        tx.character.update({
          where: { userId: player1Id },
          data: {
            currentExp: levelResult.newExp,
            level: levelResult.newLevel,
            freePoints: levelResult.newFreePoints,
          },
        })
      );
    }

    if (exp2 > 0) {
      const levelResult = processLevelUp({
        level: char2.level,
        currentExp: char2.currentExp + exp2,
        freePoints: char2.freePoints,
      });
      updates.push(
        tx.character.update({
          where: { userId: player2Id },
          data: {
            currentExp: levelResult.newExp,
            level: levelResult.newLevel,
            freePoints: levelResult.newFreePoints,
          },
        })
      );
    }

    await Promise.all(updates);

    // ---- Ranking SOLO_1V1 ----
    const rankingUpdates: Promise<unknown>[] = [];

    for (const { charId, pId } of [
      { charId: char1.id, pId: player1Id },
      { charId: char2.id, pId: player2Id },
    ]) {
      const result = getResult(pId);
      const rankingChange =
        result === "VICTORY"
          ? RANKING_1V1_WIN
          : result === "DEFEAT"
            ? RANKING_1V1_LOSS
            : RANKING_1V1_DRAW;
      const winsInc = result === "VICTORY" ? 1 : 0;
      const lossesInc = result === "DEFEAT" ? 1 : 0;
      const drawsInc = result === "DRAW" ? 1 : 0;

      const existing = await tx.pvpStats.findUnique({
        where: {
          characterId_mode: {
            characterId: charId,
            mode: "SOLO_1V1",
          },
        },
      });

      if (existing) {
        const newRanking = Math.max(0, existing.rankingPoints + rankingChange);
        rankingUpdates.push(
          tx.pvpStats.update({
            where: { id: existing.id },
            data: {
              wins: existing.wins + winsInc,
              losses: existing.losses + lossesInc,
              draws: existing.draws + drawsInc,
              rankingPoints: newRanking,
            },
          })
        );
      } else {
        rankingUpdates.push(
          tx.pvpStats.create({
            data: {
              characterId: charId,
              mode: "SOLO_1V1",
              wins: winsInc,
              losses: lossesInc,
              draws: drawsInc,
              rankingPoints: Math.max(0, rankingChange),
            },
          })
        );
      }
    }

    await Promise.all(rankingUpdates);

    console.log(
      `[Socket.io] Batalha ${battleId} persistida. EXP: ${player1Id}=${exp1}, ${player2Id}=${exp2}`
    );
  });
}

// ---------------------------------------------------------------------------
// Processar turno (chamado quando ambos jogadores enviaram ou timer expirou)
// ---------------------------------------------------------------------------

function processTurn(
  io: Server,
  battleId: string,
  session: PvpBattleSession
): void {
  const actions: [TurnAction, TurnAction] = [
    session.pendingActions.get(session.state.players[0].playerId) ?? {
      playerId: session.state.players[0].playerId,
      skillId: null,
    },
    session.pendingActions.get(session.state.players[1].playerId) ?? {
      playerId: session.state.players[1].playerId,
      skillId: null,
    },
  ];

  const result = resolveTurn(session.state, actions);
  session.state = result.state;
  session.pendingActions.clear();

  const p1Socket = io.sockets.sockets.get(session.player1SocketId);
  const p2Socket = io.sockets.sockets.get(session.player2SocketId);
  const p1Id = session.state.players[0].playerId;
  const p2Id = session.state.players[1].playerId;
  p1Socket?.emit("battle:state", { state: sanitizeStateForPlayer(result.state, p1Id), events: result.events });
  p2Socket?.emit("battle:state", { state: sanitizeStateForPlayer(result.state, p2Id), events: result.events });

  if (result.state.status === "FINISHED") {
    io.to(battleId).emit("battle:end", {
      winnerId: result.state.winnerId,
    });

    persistBattleResult(battleId, result.state).catch((err) => {
      console.log(
        `[Socket.io] Erro ao persistir batalha ${battleId}: ${String(err)}`
      );
    });

    removePvpBattle(battleId);
    console.log(
      `[Socket.io] Batalha ${battleId} finalizada. Vencedor: ${result.state.winnerId ?? "empate"}`
    );
  } else {
    startTurnTimer(io, battleId, session);
  }
}

// ---------------------------------------------------------------------------
// Timer de turno (30 segundos)
// ---------------------------------------------------------------------------

export function startTurnTimer(
  io: Server,
  battleId: string,
  session: PvpBattleSession
): void {
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
  }

  // Capturar turno atual para guard contra execucao duplicada
  const turnWhenStarted = session.state.turnNumber;

  session.turnTimer = setTimeout(() => {
    // Guard: se o turno ja avancou, o timer e stale — ignorar
    if (session.state.turnNumber !== turnWhenStarted) {
      return;
    }

    // Inserir skip para jogadores que nao enviaram acao
    for (const player of session.state.players) {
      if (!session.pendingActions.has(player.playerId)) {
        session.pendingActions.set(player.playerId, {
          playerId: player.playerId,
          skillId: null,
        });
      }
    }

    console.log(
      `[Socket.io] Timer expirou para batalha ${battleId} (turno ${session.state.turnNumber})`
    );

    processTurn(io, battleId, session);
  }, TURN_TIMEOUT_MS);
}

// ---------------------------------------------------------------------------
// Registro de handlers
// ---------------------------------------------------------------------------

export function registerBattleHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  // ---- battle:request-state ----
  socket.on("battle:request-state", () => {
    const result = getPlayerBattle(userId);
    if (!result) {
      socket.emit("battle:error", { message: "Nenhuma batalha ativa" });
      return;
    }

    const { battleId, session } = result;

    // Re-join room (pode ter perdido ao navegar)
    socket.join(battleId);

    // Atualizar socketId no store
    updatePlayerSocket(battleId, userId, socket.id);

    socket.emit("battle:state", {
      state: sanitizeStateForPlayer(session.state, userId),
      events: [],
    });
  });

  // ---- battle:action ----
  socket.on("battle:action", (payload: unknown) => {
    // Validar payload
    if (typeof payload !== "object" || payload === null) {
      socket.emit("battle:error", { message: "Payload invalido" });
      return;
    }

    const p = payload as Record<string, unknown>;

    if (typeof p.battleId !== "string") {
      socket.emit("battle:error", { message: "battleId deve ser string" });
      return;
    }

    if (p.skillId !== null && typeof p.skillId !== "string") {
      socket.emit("battle:error", {
        message: "skillId deve ser string ou null",
      });
      return;
    }

    const battleId = p.battleId;
    const skillId = p.skillId as string | null;

    // Buscar batalha
    const session = getPvpBattle(battleId);
    if (!session) {
      socket.emit("battle:error", { message: "Batalha nao encontrada" });
      return;
    }

    // Validar que o jogador pertence a batalha
    const isPlayer =
      session.state.players[0].playerId === userId ||
      session.state.players[1].playerId === userId;
    if (!isPlayer) {
      socket.emit("battle:error", {
        message: "Voce nao pertence a esta batalha",
      });
      return;
    }

    // Validar que o jogador possui a skill equipada
    if (skillId !== null) {
      const playerState = session.state.players.find(p => p.playerId === userId);
      if (!playerState?.equippedSkills.some(es => es.skillId === skillId)) {
        socket.emit("battle:error", { message: "Skill nao equipada" });
        return;
      }
    }

    // Rejeitar se batalha ja terminou
    if (session.state.status === "FINISHED") {
      socket.emit("battle:error", { message: "Batalha ja terminou" });
      return;
    }

    // Rejeitar se jogador ja enviou acao neste turno
    if (session.pendingActions.has(userId)) {
      socket.emit("battle:error", {
        message: "Voce ja enviou sua acao neste turno",
      });
      return;
    }

    // Armazenar acao
    const action: TurnAction = { playerId: userId, skillId };
    session.pendingActions.set(userId, action);

    console.log(
      `[Socket.io] ${userId} enviou acao na batalha ${battleId} (skill: ${skillId ?? "skip"})`
    );

    // Se ambos jogadores enviaram, resolver turno
    if (session.pendingActions.size === 2) {
      if (session.turnTimer) {
        clearTimeout(session.turnTimer);
        session.turnTimer = null;
      }
      processTurn(io, battleId, session);
    }
  });

}

export function handleBattleDisconnect(
  io: Server,
  _socket: Socket,
  userId: string,
): void {
  const result = getPlayerBattle(userId);
  if (!result) return;

  const { battleId, session } = result;

  // Se ja tem outro jogador desconectado, ambos sairam — empate por abandono
  if (session.disconnectedPlayer) {
    clearTimeout(session.disconnectedPlayer.disconnectTimer);
    session.state.status = "FINISHED";
    session.state.winnerId = null;

    io.to(battleId).emit("battle:end", { winnerId: null });

    persistBattleResult(battleId, session.state).catch((err) => {
      console.log(
        `[Socket.io] Erro ao persistir batalha ${battleId} (ambos desconectaram): ${String(err)}`
      );
    });

    if (session.turnTimer) {
      clearTimeout(session.turnTimer);
      session.turnTimer = null;
    }

    removePvpBattle(battleId);

    console.log(
      `[Socket.io] Ambos jogadores desconectaram da batalha ${battleId}. Empate por abandono.`
    );
    return;
  }

  // Pausar timer de turno enquanto jogador esta offline
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
    session.turnTimer = null;
  }

  const opponentId =
    session.state.players[0].playerId === userId
      ? session.state.players[1].playerId
      : session.state.players[0].playerId;

  // Iniciar grace period de reconexao
  const disconnectTimer = setTimeout(() => {
    session.state.status = "FINISHED";
    session.state.winnerId = opponentId;
    session.disconnectedPlayer = null;

    io.to(battleId).emit("battle:end", { winnerId: opponentId });

    persistBattleResult(battleId, session.state).catch((err) => {
      console.log(
        `[Socket.io] Erro ao persistir batalha ${battleId} (grace period expirou): ${String(err)}`
      );
    });

    removePvpBattle(battleId);

    console.log(
      `[Socket.io] Grace period expirou para ${userId} na batalha ${battleId}. Vencedor: ${opponentId}`
    );
  }, RECONNECT_GRACE_MS);

  session.disconnectedPlayer = { playerId: userId, disconnectTimer };

  io.to(battleId).emit("battle:player-disconnected", {
    playerId: userId,
    gracePeriodMs: RECONNECT_GRACE_MS,
  });

  console.log(
    `[Socket.io] ${userId} desconectou da batalha ${battleId}. Grace period de ${RECONNECT_GRACE_MS / 1000}s iniciado.`
  );
}

// ---------------------------------------------------------------------------
// Reconexao de jogador desconectado
// ---------------------------------------------------------------------------

export function handleReconnection(
  io: Server,
  socket: Socket,
  userId: string
): boolean {
  const result = getPlayerBattle(userId);
  if (!result) return false;

  const { battleId, session } = result;

  if (!session.disconnectedPlayer || session.disconnectedPlayer.playerId !== userId) {
    return false;
  }

  // Limpar grace period timer
  clearTimeout(session.disconnectedPlayer.disconnectTimer);
  session.disconnectedPlayer = null;

  // Atualizar socketId no store
  updatePlayerSocket(battleId, userId, socket.id);

  // Novo socket entra na sala
  socket.join(battleId);

  // Reiniciar timer de turno
  startTurnTimer(io, battleId, session);

  // Notificar sala
  io.to(battleId).emit("battle:player-reconnected", { playerId: userId });

  // Enviar estado sanitizado para o jogador reconectado
  socket.emit("battle:state", {
    state: sanitizeStateForPlayer(session.state, userId),
    events: [],
  });

  console.log(
    `[Socket.io] ${userId} reconectou na batalha ${battleId}. Batalha retomada.`
  );

  return true;
}
