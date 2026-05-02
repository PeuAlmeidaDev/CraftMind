// server/handlers/pvp-team-battle.ts — Handlers de batalha PvP Team 2v2

import type { Server, Socket } from "socket.io";
import type { PlayerState, BaseStats, ActiveStatusEffect, TurnLogEntry } from "../../lib/battle/types";
import type {
  PvpTeamBattleState,
  PvpTeamAction,
  PvpTeamBattleSession,
} from "../../lib/battle/pvp-team-types";
import { resolvePvpTeamTurn } from "../../lib/battle/pvp-team-turn";
import {
  getPvpTeamBattle,
  removePvpTeamBattle,
  getPlayerPvpTeamBattle,
  updatePvpTeamPlayerSocket,
} from "../stores/pvp-team-battle-store";
import { prisma } from "../lib/prisma";

const TURN_TIMEOUT_MS = 30_000;
const RECONNECT_GRACE_MS = 30_000;

// Track which players have loaded the PvP Team battle page per battle
const readyPlayers = new Map<string, Set<string>>();

// ---------------------------------------------------------------------------
// Ranking point constants
// ---------------------------------------------------------------------------

const RANKING_WIN = 25;
const RANKING_LOSS = 15;
const RANKING_DRAW = 5;

// ---------------------------------------------------------------------------
// Tipo auxiliar para estado sanitizado do inimigo (esconder internos)
// ---------------------------------------------------------------------------

type SanitizedEnemyPlayer = {
  playerId: string;
  characterId: string;
  baseStats: BaseStats;
  currentHp: number;
  statusEffects: ActiveStatusEffect[];
};

type SanitizedPvpTeamState = {
  battleId: string;
  turnNumber: number;
  myTeam: PlayerState[];
  enemyTeam: SanitizedEnemyPlayer[];
  myTeamNumber: 1 | 2;
  mode: string;
  status: string;
  winnerTeam: 1 | 2 | null;
  turnLog: TurnLogEntry[];
  playerNames: Record<string, string>;
  playerAvatars: Record<string, string | null>;
  playerHouses: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Sanitizar estado para um jogador (aliados completos, inimigos limitados)
// ---------------------------------------------------------------------------

function sanitizeStateForPlayer(
  state: PvpTeamBattleState,
  userId: string,
  session: PvpTeamBattleSession,
): SanitizedPvpTeamState {
  const myTeamNum = session.playerTeams.get(userId) ?? 1;
  const myTeam = myTeamNum === 1 ? state.team1 : state.team2;
  const enemyTeam = myTeamNum === 1 ? state.team2 : state.team1;

  const sanitizedEnemy: SanitizedEnemyPlayer[] = enemyTeam.map((p) => ({
    playerId: p.playerId,
    characterId: p.characterId,
    baseStats: { ...p.baseStats },
    currentHp: p.currentHp,
    statusEffects: [...p.statusEffects],
  }));

  return {
    battleId: state.battleId,
    turnNumber: state.turnNumber,
    myTeam: myTeam.map((p) => ({ ...p })),
    enemyTeam: sanitizedEnemy,
    myTeamNumber: myTeamNum,
    mode: state.mode,
    status: state.status,
    winnerTeam: state.winnerTeam,
    turnLog: [...state.turnLog],
    playerNames: Object.fromEntries(session.playerNames),
    playerAvatars: Object.fromEntries(session.playerAvatars),
    playerHouses: Object.fromEntries(session.playerHouses),
  };
}

// ---------------------------------------------------------------------------
// Persistir resultado da PvP Team battle (fire-and-forget)
// ---------------------------------------------------------------------------

async function persistPvpTeamResult(session: PvpTeamBattleSession): Promise<void> {
  const { state, battleId } = session;

  await prisma.$transaction(async (tx) => {
    // Atualizar TeamBattle
    await tx.teamBattle.update({
      where: { id: battleId },
      data: {
        status: "FINISHED",
        winnerTeam: state.winnerTeam,
        turns: state.turnNumber,
        log: state.turnLog as object[],
        finishedAt: new Date(),
      },
    });

    // Upsert PvpStats para cada jogador
    const allPlayers = [...state.team1, ...state.team2];
    for (const player of allPlayers) {
      const teamNum = session.playerTeams.get(player.playerId);
      if (!teamNum) continue;

      let winsInc = 0;
      let lossesInc = 0;
      let drawsInc = 0;
      let rankingChange = 0;

      if (state.winnerTeam === null) {
        // Empate
        drawsInc = 1;
        rankingChange = RANKING_DRAW;
      } else if (state.winnerTeam === teamNum) {
        // Vitoria
        winsInc = 1;
        rankingChange = RANKING_WIN;
      } else {
        // Derrota
        lossesInc = 1;
        rankingChange = -RANKING_LOSS;
      }

      // Upsert: criar se nao existe, atualizar se existe
      const existing = await tx.pvpStats.findUnique({
        where: {
          characterId_mode: {
            characterId: player.characterId,
            mode: "TEAM_2V2",
          },
        },
      });

      if (existing) {
        const newRanking = Math.max(0, existing.rankingPoints + rankingChange);
        await tx.pvpStats.update({
          where: { id: existing.id },
          data: {
            wins: existing.wins + winsInc,
            losses: existing.losses + lossesInc,
            draws: existing.draws + drawsInc,
            rankingPoints: newRanking,
          },
        });
      } else {
        await tx.pvpStats.create({
          data: {
            characterId: player.characterId,
            mode: "TEAM_2V2",
            wins: winsInc,
            losses: lossesInc,
            draws: drawsInc,
            rankingPoints: Math.max(0, rankingChange),
          },
        });
      }
    }
  });

  console.log(
    `[Socket.io] PvP Team ${battleId} persistida. Vencedor: ${state.winnerTeam === null ? "Empate" : `Time ${state.winnerTeam}`}`
  );
}

// ---------------------------------------------------------------------------
// Processar turno (chamado quando todos players vivos enviaram ou timer expirou)
// ---------------------------------------------------------------------------

function processPvpTeamTurn(
  io: Server,
  battleId: string,
  session: PvpTeamBattleSession,
): void {
  const { state } = session;
  const roomName = `pvp-team-battle:${battleId}`;

  // Montar acoes: players vivos que enviaram + auto-skip para AFK/mortos/desconectados
  const allPlayers = [...state.team1, ...state.team2];
  const actions: PvpTeamAction[] = allPlayers
    .filter((p) => p.currentHp > 0)
    .map((player) => {
      const pending = session.pendingActions.get(player.playerId);
      if (pending) return pending;

      // Auto-skip para AFK ou autoSkipPlayers
      return {
        playerId: player.playerId,
        skillId: null,
      };
    });

  const result = resolvePvpTeamTurn(state, actions);
  session.state = result.state;
  session.pendingActions.clear();
  session.lastActivityAt = Date.now();

  if (result.state.status === "FINISHED") {
    // Emitir estado final sanitizado para cada jogador
    for (const [pUserId, pSocketId] of session.playerSockets) {
      const pSocket = io.sockets.sockets.get(pSocketId);
      if (pSocket) {
        const sanitized = sanitizeStateForPlayer(result.state, pUserId, session);
        pSocket.emit("pvp-team:battle:state", {
          state: sanitized,
          events: result.events,
        });
      }
    }

    io.to(roomName).emit("pvp-team:battle:end", {
      winnerTeam: result.state.winnerTeam,
    });

    persistPvpTeamResult(session).catch((err: unknown) => {
      console.log(
        `[Socket.io] Erro ao persistir PvP Team ${battleId}: ${String(err)}`
      );
    });

    readyPlayers.delete(battleId);
    removePvpTeamBattle(battleId);

    console.log(
      `[Socket.io] PvP Team ${battleId} finalizada. Vencedor: ${result.state.winnerTeam === null ? "Empate" : `Time ${result.state.winnerTeam}`}`
    );
  } else {
    // Emitir estado sanitizado para cada jogador individualmente
    for (const [pUserId, pSocketId] of session.playerSockets) {
      const pSocket = io.sockets.sockets.get(pSocketId);
      if (pSocket) {
        const sanitized = sanitizeStateForPlayer(result.state, pUserId, session);
        pSocket.emit("pvp-team:battle:state", {
          state: sanitized,
          events: result.events,
        });
      }
    }

    startPvpTeamTurnTimer(io, battleId, session);
  }
}

// ---------------------------------------------------------------------------
// Timer de turno (30 segundos)
// ---------------------------------------------------------------------------

function startPvpTeamTurnTimer(
  io: Server,
  battleId: string,
  session: PvpTeamBattleSession,
): void {
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
  }

  session.turnTimer = setTimeout(() => {
    console.log(
      `[Socket.io] PvP Team turn timer expirou para batalha ${battleId} (turno ${session.state.turnNumber})`
    );

    processPvpTeamTurn(io, battleId, session);
  }, TURN_TIMEOUT_MS);
}

// ---------------------------------------------------------------------------
// Registro de handlers
// ---------------------------------------------------------------------------

export function registerPvpTeamBattleHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  // -------------------------------------------------------------------------
  // pvp-team:battle:request-state
  // -------------------------------------------------------------------------

  socket.on("pvp-team:battle:request-state", () => {
    const result = getPlayerPvpTeamBattle(userId);
    if (!result) {
      socket.emit("pvp-team:battle:error", {
        message: "Nenhuma batalha PvP Team ativa encontrada",
      });
      return;
    }

    const { battleId, session } = result;

    // Join this socket to the battle room
    const roomName = `pvp-team-battle:${battleId}`;
    socket.join(roomName);

    // Update socket reference in session
    session.playerSockets.set(userId, socket.id);

    const sanitized = sanitizeStateForPlayer(session.state, userId, session);

    socket.emit("pvp-team:battle:state", {
      state: sanitized,
      events: [],
    });

    // Start turn timer only when ALL alive players have loaded the page
    if (session.state.status === "IN_PROGRESS" && !session.turnTimer) {
      if (!readyPlayers.has(battleId)) {
        readyPlayers.set(battleId, new Set());
      }
      readyPlayers.get(battleId)!.add(userId);

      const allPlayers = [...session.state.team1, ...session.state.team2];
      const alivePlayers = allPlayers.filter(
        (p) => p.currentHp > 0 && !session.autoSkipPlayers.has(p.playerId)
      );
      const allReady = alivePlayers.every((p) =>
        readyPlayers.get(battleId)!.has(p.playerId)
      );
      if (allReady) {
        readyPlayers.delete(battleId);
        startPvpTeamTurnTimer(io, battleId, session);
        console.log(
          `[Socket.io] Todos os players carregaram — turn timer PvP Team iniciado para batalha ${battleId}`
        );
      } else {
        console.log(
          `[Socket.io] Player ${userId} carregou PvP Team ${battleId} (${readyPlayers.get(battleId)!.size}/${alivePlayers.length})`
        );
      }
    }
  });

  // -------------------------------------------------------------------------
  // pvp-team:battle:action
  // -------------------------------------------------------------------------

  socket.on("pvp-team:battle:action", (payload: unknown) => {
    // Validar payload
    if (typeof payload !== "object" || payload === null) {
      socket.emit("pvp-team:battle:error", { message: "Payload invalido" });
      return;
    }

    const p = payload as Record<string, unknown>;

    if (typeof p.battleId !== "string") {
      socket.emit("pvp-team:battle:error", {
        message: "battleId deve ser string",
      });
      return;
    }

    if (p.skillId !== null && typeof p.skillId !== "string") {
      socket.emit("pvp-team:battle:error", {
        message: "skillId deve ser string ou null",
      });
      return;
    }

    if (p.targetIndex !== undefined && p.targetIndex !== null && typeof p.targetIndex !== "number") {
      socket.emit("pvp-team:battle:error", {
        message: "targetIndex deve ser number ou undefined",
      });
      return;
    }

    if (p.targetId !== undefined && p.targetId !== null && typeof p.targetId !== "string") {
      socket.emit("pvp-team:battle:error", {
        message: "targetId deve ser string, null ou undefined",
      });
      return;
    }

    const battleId = p.battleId as string;
    const skillId = p.skillId as string | null;
    const targetIndex = p.targetIndex as number | undefined;
    const targetId = p.targetId as string | undefined;

    // Buscar sessao
    const session = getPvpTeamBattle(battleId);
    if (!session) {
      socket.emit("pvp-team:battle:error", {
        message: "Batalha PvP Team nao encontrada",
      });
      return;
    }

    // Verificar player pertence
    if (!session.playerSockets.has(userId)) {
      socket.emit("pvp-team:battle:error", {
        message: "Voce nao pertence a esta batalha PvP Team",
      });
      return;
    }

    // Verificar status IN_PROGRESS
    if (session.state.status !== "IN_PROGRESS") {
      socket.emit("pvp-team:battle:error", {
        message: "Batalha PvP Team nao esta em progresso",
      });
      return;
    }

    // Verificar player vivo
    const allPlayers = [...session.state.team1, ...session.state.team2];
    const playerState = allPlayers.find((pl) => pl.playerId === userId);
    if (!playerState || playerState.currentHp <= 0) {
      socket.emit("pvp-team:battle:error", {
        message: "Seu personagem esta morto",
      });
      return;
    }

    // Verificar acao duplicada
    if (session.pendingActions.has(userId)) {
      socket.emit("pvp-team:battle:error", {
        message: "Voce ja enviou sua acao neste turno",
      });
      return;
    }

    // Verificar que nao eh autoSkip
    if (session.autoSkipPlayers.has(userId)) {
      socket.emit("pvp-team:battle:error", {
        message: "Voce foi marcado como auto-skip por desconexao",
      });
      return;
    }

    // Validar skill equipada e nao em cooldown
    if (skillId !== null) {
      const equipped = playerState.equippedSkills.find(
        (es) => es.skillId === skillId
      );
      if (!equipped) {
        socket.emit("pvp-team:battle:error", {
          message: "Skill nao equipada",
        });
        return;
      }

      if (
        playerState.cooldowns[skillId] &&
        playerState.cooldowns[skillId] > 0
      ) {
        socket.emit("pvp-team:battle:error", {
          message: "Skill em cooldown",
        });
        return;
      }
    }

    // Armazenar acao
    const action: PvpTeamAction = { playerId: userId, skillId, targetIndex, targetId };
    session.pendingActions.set(userId, action);
    session.lastActivityAt = Date.now();

    const roomName = `pvp-team-battle:${battleId}`;
    const alivePlayers = allPlayers.filter(
      (pl) => pl.currentHp > 0 && !session.autoSkipPlayers.has(pl.playerId)
    );

    io.to(roomName).emit("pvp-team:action:received", {
      playerId: userId,
      total: session.pendingActions.size,
      expected: alivePlayers.length,
    });

    console.log(
      `[Socket.io] ${userId} enviou acao na PvP Team ${battleId} (skill: ${skillId ?? "skip"}, targetIndex: ${targetIndex ?? "N/A"}, targetId: ${targetId ?? "N/A"})`
    );

    // Se todos os vivos (nao auto-skip) enviaram, resolver turno
    const allActionsReceived = alivePlayers.every((pl) =>
      session.pendingActions.has(pl.playerId)
    );

    if (allActionsReceived) {
      if (session.turnTimer) {
        clearTimeout(session.turnTimer);
        session.turnTimer = null;
      }
      processPvpTeamTurn(io, battleId, session);
    }
  });

  // disconnect cleanup centralizado em handlePvpTeamBattleDisconnect
}

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

export function handlePvpTeamBattleDisconnect(
  io: Server,
  _socket: Socket,
  userId: string,
): void {
  const result = getPlayerPvpTeamBattle(userId);
  if (!result) return;

  const { battleId, session } = result;

  // Ignorar se match ainda pendente (tratado pelo matchmaking handler)
  if (session.matchTimer) return;

  // Ignorar se batalha ja terminou
  if (session.state.status !== "IN_PROGRESS") return;

  const roomName = `pvp-team-battle:${battleId}`;

  // Iniciar grace period
  const disconnectTimer = setTimeout(() => {
    const currentSession = getPvpTeamBattle(battleId);
    if (!currentSession) return;

    // Se o player reconectou durante o grace, o timer foi limpo
    if (!currentSession.disconnectedPlayers.has(userId)) return;

    currentSession.disconnectedPlayers.delete(userId);

    // Adicionar a autoSkipPlayers (skip permanente, time continua 1v2)
    currentSession.autoSkipPlayers.add(userId);

    // Checar se ambos do mesmo time desconectaram permanentemente
    const myTeamNum = currentSession.playerTeams.get(userId);
    if (myTeamNum) {
      const myTeamPlayers = myTeamNum === 1
        ? currentSession.state.team1
        : currentSession.state.team2;

      const bothDisconnected = myTeamPlayers.every(
        (p) => currentSession.autoSkipPlayers.has(p.playerId)
      );

      if (bothDisconnected) {
        // Ambos do time desconectaram — derrota do time
        currentSession.state.status = "FINISHED";
        currentSession.state.winnerTeam = myTeamNum === 1 ? 2 : 1;

        if (currentSession.turnTimer) {
          clearTimeout(currentSession.turnTimer);
          currentSession.turnTimer = null;
        }

        // Emitir estado final
        for (const [pUserId, pSocketId] of currentSession.playerSockets) {
          const pSocket = io.sockets.sockets.get(pSocketId);
          if (pSocket) {
            const sanitized = sanitizeStateForPlayer(currentSession.state, pUserId, currentSession);
            pSocket.emit("pvp-team:battle:state", {
              state: sanitized,
              events: [],
            });
          }
        }

        io.to(roomName).emit("pvp-team:battle:end", {
          winnerTeam: currentSession.state.winnerTeam,
          message: "Time adversario desconectou. Voce venceu!",
        });

        persistPvpTeamResult(currentSession).catch((err: unknown) => {
          console.log(
            `[Socket.io] Erro ao persistir PvP Team ${battleId} (desconexao): ${String(err)}`
          );
        });

        readyPlayers.delete(battleId);
        removePvpTeamBattle(battleId);
        console.log(
          `[Socket.io] PvP Team ${battleId} encerrada: ambos do time ${myTeamNum} desconectaram`
        );
        return;
      }
    }

    // Time continua 1v2
    io.to(roomName).emit("pvp-team:battle:player-auto-skip", {
      playerId: userId,
      message: "Jogador desconectou permanentemente e tera skip automatico.",
    });

    console.log(
      `[Socket.io] ${userId} adicionado a autoSkipPlayers na PvP Team ${battleId}`
    );
  }, RECONNECT_GRACE_MS);

  session.disconnectedPlayers.set(userId, { disconnectTimer });
  session.lastActivityAt = Date.now();

  io.to(roomName).emit("pvp-team:battle:player-disconnected", {
    playerId: userId,
    gracePeriodMs: RECONNECT_GRACE_MS,
  });

  console.log(
    `[Socket.io] ${userId} desconectou da PvP Team ${battleId}. Grace period de ${RECONNECT_GRACE_MS / 1000}s iniciado.`
  );
}

// ---------------------------------------------------------------------------
// Reconexao de jogador desconectado em PvP Team battle
// ---------------------------------------------------------------------------

export function handlePvpTeamReconnection(
  io: Server,
  socket: Socket,
  userId: string,
): boolean {
  const result = getPlayerPvpTeamBattle(userId);
  if (!result) return false;

  const { battleId, session } = result;

  const disconnectEntry = session.disconnectedPlayers.get(userId);
  if (!disconnectEntry) return false;

  // Limpar disconnect timer
  clearTimeout(disconnectEntry.disconnectTimer);
  session.disconnectedPlayers.delete(userId);

  // Atualizar socketId
  updatePvpTeamPlayerSocket(battleId, userId, socket.id);

  // Join room
  const roomName = `pvp-team-battle:${battleId}`;
  socket.join(roomName);

  session.lastActivityAt = Date.now();

  // Notificar sala
  io.to(roomName).emit("pvp-team:battle:player-reconnected", {
    playerId: userId,
  });

  // Enviar estado atual para o jogador reconectado
  const sanitized = sanitizeStateForPlayer(session.state, userId, session);
  socket.emit("pvp-team:battle:state", {
    state: sanitized,
    events: [],
  });

  console.log(
    `[Socket.io] ${userId} reconectou na PvP Team ${battleId}. Batalha retomada.`
  );

  return true;
}
