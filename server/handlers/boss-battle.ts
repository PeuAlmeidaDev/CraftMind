// server/handlers/boss-battle.ts — Handlers de batalha cooperativa (Boss Fight 3v1)

import type { Server, Socket } from "socket.io";
import type { PlayerState } from "../../lib/battle/types";
import type { CoopBattleState, CoopTurnAction } from "../../lib/battle/coop-types";
import { resolveCoopTurn } from "../../lib/battle/coop-turn";
import { calculateMobExp, calculateExpGained } from "../../lib/exp/formulas";
import { processLevelUp } from "../../lib/exp/level-up";
import {
  getBossBattle,
  removeBossBattle,
  getPlayerBossBattle,
  updateBossPlayerSocket,
} from "../stores/boss-battle-store";
import type { BossBattleSession } from "../stores/boss-battle-store";
import { prisma } from "../lib/prisma";

const TURN_TIMEOUT_MS = 30_000;
const RECONNECT_GRACE_MS = 30_000;

// Track which players have loaded the boss-fight page per battle
const readyPlayers = new Map<string, Set<string>>();

// ---------------------------------------------------------------------------
// Tipo auxiliar para estado sanitizado do boss (esconder internos)
// ---------------------------------------------------------------------------

type SanitizedBossState = Pick<
  PlayerState,
  "playerId" | "baseStats" | "currentHp" | "statusEffects"
>;

type SanitizedCoopState = {
  battleId: string;
  turnNumber: number;
  team: PlayerState[];
  boss: SanitizedBossState;
  turnLog: CoopBattleState["turnLog"];
  status: CoopBattleState["status"];
  winnerId: CoopBattleState["winnerId"];
  bossName: string;
  playerNames: Record<string, string>; // playerId -> name
  playerAvatars: Record<string, string | null>; // userId -> avatarUrl
  playerHouses: Record<string, string>; // userId -> HouseName
};

// ---------------------------------------------------------------------------
// Sanitizar estado para o time (boss com dados limitados)
// ---------------------------------------------------------------------------

function sanitizeCoopStateForTeam(
  state: CoopBattleState,
  bossName: string,
  playerNames: Record<string, string>,
  playerAvatars: Record<string, string | null>,
  playerHouses: Record<string, string>,
): SanitizedCoopState {
  const sanitizedBoss: SanitizedBossState = {
    playerId: state.boss.playerId,
    baseStats: { ...state.boss.baseStats },
    currentHp: state.boss.currentHp,
    statusEffects: [...state.boss.statusEffects],
  };

  return {
    battleId: state.battleId,
    turnNumber: state.turnNumber,
    team: state.team.map((p) => ({ ...p })),
    boss: sanitizedBoss,
    turnLog: [...state.turnLog],
    status: state.status,
    winnerId: state.winnerId,
    bossName,
    playerNames,
    playerAvatars,
    playerHouses,
  };
}

// ---------------------------------------------------------------------------
// Persistir resultado da boss battle (fire-and-forget)
// ---------------------------------------------------------------------------

async function persistBossBattleResult(
  battleId: string,
  session: BossBattleSession
): Promise<void> {
  const { state } = session;
  const isVictory = state.winnerId === "team";
  const result = isVictory ? "VICTORY" : "DEFEAT";

  // Calcular EXP base do boss
  const bossBaseExp = calculateMobExp(state.boss.baseStats);

  await prisma.coopBattle.update({
    where: { id: battleId },
    data: {
      status: "FINISHED",
      result,
      turns: state.turnNumber,
      expGained: isVictory ? Math.floor(bossBaseExp * 1.5) : 0,
      log: state.turnLog as object[],
    },
  });

  if (!isVictory) {
    console.log(
      `[Socket.io] Boss battle ${battleId} persistida. Resultado: DEFEAT`
    );
    return;
  }

  // Distribuir EXP e bossEssence para cada player
  await prisma.$transaction(async (tx) => {
    const playerIds = state.team.map((p) => p.playerId);

    const characters = await tx.character.findMany({
      where: { userId: { in: playerIds } },
    });

    const updates: Promise<unknown>[] = [];

    for (const char of characters) {
      const expGained = calculateExpGained(
        Math.floor(bossBaseExp * 1.5),
        char.level,
        session.bossTier
      );

      const levelResult = processLevelUp({
        level: char.level,
        currentExp: char.currentExp + expGained,
        freePoints: char.freePoints,
      });

      updates.push(
        tx.character.update({
          where: { userId: char.userId },
          data: {
            currentExp: levelResult.newExp,
            level: levelResult.newLevel,
            freePoints: levelResult.newFreePoints,
            bossEssence: { increment: 1 },
          },
        })
      );

      console.log(
        `[Socket.io] Boss battle ${battleId}: ${char.userId} ganhou ${expGained} EXP`
      );
    }

    await Promise.all(updates);
  });

  console.log(
    `[Socket.io] Boss battle ${battleId} persistida. Resultado: VICTORY`
  );
}

// ---------------------------------------------------------------------------
// Processar turno (chamado quando todos jogadores vivos enviaram ou timer expirou)
// ---------------------------------------------------------------------------

function processBossTurn(
  io: Server,
  battleId: string,
  session: BossBattleSession
): void {
  const { state } = session;
  const roomName = `boss-battle:${battleId}`;

  // Montar 3 acoes (auto-skip para mortos e AFK)
  const teamActions: CoopTurnAction[] = state.team.map((player) => {
    const pending = session.pendingActions.get(player.playerId);
    if (pending) return pending;

    // Auto-skip para mortos ou AFK
    return {
      playerId: player.playerId,
      skillId: null,
    };
  });

  const result = resolveCoopTurn(state, teamActions);
  session.state = result.state;
  session.pendingActions.clear();
  session.lastActivityAt = Date.now();

  if (result.state.status === "FINISHED") {
    io.to(roomName).emit("boss:battle:state", {
      state: sanitizeCoopStateForTeam(
        result.state,
        session.bossName,
        Object.fromEntries(session.playerNames),
        Object.fromEntries(session.playerAvatars),
        Object.fromEntries(session.playerHouses),
      ),
      events: result.events,
    });

    io.to(roomName).emit("boss:battle:end", {
      result: result.state.winnerId === "team" ? "VICTORY" : "DEFEAT",
      winnerId: result.state.winnerId,
    });

    persistBossBattleResult(battleId, session).catch((err) => {
      console.log(
        `[Socket.io] Erro ao persistir boss battle ${battleId}: ${String(err)}`
      );
    });

    readyPlayers.delete(battleId);
    removeBossBattle(battleId);

    console.log(
      `[Socket.io] Boss battle ${battleId} finalizada. Resultado: ${result.state.winnerId === "team" ? "VICTORY" : "DEFEAT"}`
    );
  } else {
    io.to(roomName).emit("boss:battle:state", {
      state: sanitizeCoopStateForTeam(
        result.state,
        session.bossName,
        Object.fromEntries(session.playerNames),
        Object.fromEntries(session.playerAvatars),
        Object.fromEntries(session.playerHouses),
      ),
      events: result.events,
    });

    startBossTurnTimer(io, battleId, session);
  }
}

// ---------------------------------------------------------------------------
// Timer de turno (30 segundos)
// ---------------------------------------------------------------------------

export function startBossTurnTimer(
  io: Server,
  battleId: string,
  session: BossBattleSession
): void {
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
  }

  session.turnTimer = setTimeout(() => {
    console.log(
      `[Socket.io] Boss turn timer expirou para batalha ${battleId} (turno ${session.state.turnNumber})`
    );

    processBossTurn(io, battleId, session);
  }, TURN_TIMEOUT_MS);
}

// ---------------------------------------------------------------------------
// Registro de handlers
// ---------------------------------------------------------------------------

export function registerBossBattleHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  // -------------------------------------------------------------------------
  // boss:battle:request-state — client requests current battle state on page mount
  // -------------------------------------------------------------------------

  socket.on("boss:battle:request-state", () => {
    const result = getPlayerBossBattle(userId);
    if (!result) {
      socket.emit("boss:battle:error", {
        message: "Nenhuma batalha ativa encontrada",
      });
      return;
    }

    const { battleId, session } = result;
    const sanitized = sanitizeCoopStateForTeam(
      session.state,
      session.bossName,
      Object.fromEntries(session.playerNames),
      Object.fromEntries(session.playerAvatars),
      Object.fromEntries(session.playerHouses),
    );

    socket.emit("boss:battle:state", {
      state: sanitized,
      events: [],
    });

    // Start turn timer only when ALL alive players have loaded the page.
    // If the timer is already running (e.g., reconnection mid-battle), skip tracking.
    if (session.state.status === "IN_PROGRESS" && !session.turnTimer) {
      if (!readyPlayers.has(battleId)) {
        readyPlayers.set(battleId, new Set());
      }
      readyPlayers.get(battleId)!.add(userId);

      const alivePlayers = session.state.team.filter((p) => p.currentHp > 0);
      const allReady = alivePlayers.every((p) => readyPlayers.get(battleId)!.has(p.playerId));
      if (allReady) {
        readyPlayers.delete(battleId);
        startBossTurnTimer(io, battleId, session);
        console.log(`[Socket.io] Todos os players carregaram — turn timer iniciado para batalha ${battleId}`);
      } else {
        console.log(`[Socket.io] Player ${userId} carregou batalha ${battleId} (${readyPlayers.get(battleId)!.size}/${alivePlayers.length})`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // boss:action
  // -------------------------------------------------------------------------

  socket.on("boss:action", (payload: unknown) => {
    // Validar payload
    if (typeof payload !== "object" || payload === null) {
      socket.emit("boss:battle:error", { message: "Payload invalido" });
      return;
    }

    const p = payload as Record<string, unknown>;

    if (typeof p.battleId !== "string") {
      socket.emit("boss:battle:error", {
        message: "battleId deve ser string",
      });
      return;
    }

    if (p.skillId !== null && typeof p.skillId !== "string") {
      socket.emit("boss:battle:error", {
        message: "skillId deve ser string ou null",
      });
      return;
    }

    if (p.targetId !== undefined && p.targetId !== null && typeof p.targetId !== "string") {
      socket.emit("boss:battle:error", {
        message: "targetId deve ser string, null ou undefined",
      });
      return;
    }

    const battleId = p.battleId;
    const skillId = p.skillId as string | null;
    const targetId = p.targetId as string | undefined;

    // Buscar sessao
    const session = getBossBattle(battleId);
    if (!session) {
      socket.emit("boss:battle:error", {
        message: "Boss battle nao encontrada",
      });
      return;
    }

    // Verificar player pertence
    if (!session.playerSockets.has(userId)) {
      socket.emit("boss:battle:error", {
        message: "Voce nao pertence a esta boss battle",
      });
      return;
    }

    // Verificar status IN_PROGRESS
    if (session.state.status !== "IN_PROGRESS") {
      socket.emit("boss:battle:error", {
        message: "Boss battle nao esta em progresso",
      });
      return;
    }

    // Verificar player vivo
    const playerState = session.state.team.find(
      (pl) => pl.playerId === userId
    );
    if (!playerState || playerState.currentHp <= 0) {
      socket.emit("boss:battle:error", {
        message: "Seu personagem esta morto",
      });
      return;
    }

    // Verificar acao duplicada
    if (session.pendingActions.has(userId)) {
      socket.emit("boss:battle:error", {
        message: "Voce ja enviou sua acao neste turno",
      });
      return;
    }

    // Validar skill equipada e nao em cooldown
    if (skillId !== null) {
      const equipped = playerState.equippedSkills.find(
        (es) => es.skillId === skillId
      );
      if (!equipped) {
        socket.emit("boss:battle:error", {
          message: "Skill nao equipada",
        });
        return;
      }

      if (
        playerState.cooldowns[skillId] &&
        playerState.cooldowns[skillId] > 0
      ) {
        socket.emit("boss:battle:error", {
          message: "Skill em cooldown",
        });
        return;
      }
    }

    // Armazenar acao
    const action: CoopTurnAction = { playerId: userId, skillId, targetId };
    session.pendingActions.set(userId, action);
    session.lastActivityAt = Date.now();

    const roomName = `boss-battle:${battleId}`;
    io.to(roomName).emit("boss:action:received", {
      playerId: userId,
      total: session.pendingActions.size,
      expected: session.state.team.filter((pl) => pl.currentHp > 0).length,
    });

    console.log(
      `[Socket.io] ${userId} enviou acao na boss battle ${battleId} (skill: ${skillId ?? "skip"})`
    );

    // Se todos os vivos enviaram, resolver turno
    const alivePlayers = session.state.team.filter(
      (pl) => pl.currentHp > 0
    );
    const allActionsReceived = alivePlayers.every((pl) =>
      session.pendingActions.has(pl.playerId)
    );

    if (allActionsReceived) {
      if (session.turnTimer) {
        clearTimeout(session.turnTimer);
        session.turnTimer = null;
      }
      processBossTurn(io, battleId, session);
    }
  });

  // disconnect cleanup centralizado em handleBossBattleDisconnect
}

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

export function handleBossBattleDisconnect(
  io: Server,
  _socket: Socket,
  userId: string,
): void {
  const result = getPlayerBossBattle(userId);
  if (!result) return;

  const { battleId, session } = result;

  // Ignorar se match ainda pendente (tratado pelo boss-matchmaking handler)
  if (session.matchTimer) return;

  // Ignorar se batalha ja terminou
  if (session.state.status !== "IN_PROGRESS") return;

  const roomName = `boss-battle:${battleId}`;

  // Iniciar grace period — NAO finalizar batalha por 1 disconnect
  const disconnectTimer = setTimeout(() => {
    const currentSession = getBossBattle(battleId);
    if (!currentSession) return;

    // Se o player reconectou durante o grace period, o timer de disconnect
    // foi limpo pelo handleBossReconnection. Se chegamos aqui, ele nao reconectou.
    // Mas fazemos a checagem de seguranca para evitar race condition.
    if (!currentSession.disconnectedPlayers.has(userId)) {
      // Player reconectou — nada a fazer
      return;
    }

    currentSession.disconnectedPlayers.delete(userId);

    // Verificar se TODOS os players vivos estao desconectados
    const allDisconnected = currentSession.state.team.every(
      (pl) =>
        pl.currentHp <= 0 ||
        currentSession.disconnectedPlayers.has(pl.playerId)
    );

    if (allDisconnected) {
      // Todos desconectaram — encerrar como derrota
      currentSession.state.status = "FINISHED";
      currentSession.state.winnerId = null;

      io.to(roomName).emit("boss:battle:end", {
        result: "DEFEAT",
        winnerId: null,
      });

      persistBossBattleResult(battleId, currentSession).catch((err) => {
        console.log(
          `[Socket.io] Erro ao persistir boss battle ${battleId} (todos desconectaram): ${String(err)}`
        );
      });

      readyPlayers.delete(battleId);
      removeBossBattle(battleId);
      console.log(
        `[Socket.io] Boss battle ${battleId} encerrada: todos desconectaram`
      );
    }
    // Se ainda ha players conectados, a batalha continua sem o desconectado
  }, RECONNECT_GRACE_MS);

  session.disconnectedPlayers.set(userId, { disconnectTimer });
  session.lastActivityAt = Date.now();

  io.to(roomName).emit("boss:battle:player-disconnected", {
    playerId: userId,
    gracePeriodMs: RECONNECT_GRACE_MS,
  });

  console.log(
    `[Socket.io] ${userId} desconectou da boss battle ${battleId}. Grace period de ${RECONNECT_GRACE_MS / 1000}s iniciado.`
  );
}

// ---------------------------------------------------------------------------
// Reconexao de jogador desconectado em boss battle
// ---------------------------------------------------------------------------

export function handleBossReconnection(
  io: Server,
  socket: Socket,
  userId: string
): boolean {
  const result = getPlayerBossBattle(userId);
  if (!result) return false;

  const { battleId, session } = result;

  const disconnectEntry = session.disconnectedPlayers.get(userId);
  if (!disconnectEntry) return false;

  // Limpar disconnect timer
  clearTimeout(disconnectEntry.disconnectTimer);
  session.disconnectedPlayers.delete(userId);

  // Atualizar socketId
  updateBossPlayerSocket(battleId, userId, socket.id);

  // Join room
  const roomName = `boss-battle:${battleId}`;
  socket.join(roomName);

  session.lastActivityAt = Date.now();

  // Notificar sala
  io.to(roomName).emit("boss:battle:player-reconnected", {
    playerId: userId,
  });

  // Enviar estado atual para o jogador reconectado
  socket.emit("boss:battle:state", {
    state: sanitizeCoopStateForTeam(
      session.state,
      session.bossName,
      Object.fromEntries(session.playerNames),
      Object.fromEntries(session.playerAvatars),
      Object.fromEntries(session.playerHouses),
    ),
    events: [],
  });

  console.log(
    `[Socket.io] ${userId} reconectou na boss battle ${battleId}. Batalha retomada.`
  );

  return true;
}
