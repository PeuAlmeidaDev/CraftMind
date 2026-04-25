// server/handlers/coop-pve-battle.ts — Handlers de batalha cooperativa PvE (2v3/2v5/3v5)

import type { Server, Socket } from "socket.io";
import type { PlayerState, BaseStats, ActiveStatusEffect, TurnLogEntry } from "../../lib/battle/types";
import type {
  CoopPveBattleState,
  CoopPveAction,
  CoopPveMode,
  CoopPveBattleSession,
  CoopPveMobConfig,
} from "../../lib/battle/coop-pve-types";
import type { MobState } from "../../lib/battle/pve-multi-types";
import { resolveCoopPveTurn } from "../../lib/battle/coop-pve-turn";
import { calculateMobExp, calculateExpGained } from "../../lib/exp/formulas";
import { processLevelUp } from "../../lib/exp/level-up";
import {
  getCoopPveBattle,
  removeCoopPveBattle,
  getPlayerCoopPveBattle,
  updateCoopPvePlayerSocket,
} from "../stores/coop-pve-battle-store";
import { prisma } from "../lib/prisma";

const TURN_TIMEOUT_MS = 30_000;
const RECONNECT_GRACE_MS = 30_000;

// Track which players have loaded the coop PvE battle page per battle
const readyPlayers = new Map<string, Set<string>>();

// ---------------------------------------------------------------------------
// Tipo auxiliar para estado sanitizado do mob (esconder internos)
// ---------------------------------------------------------------------------

type SanitizedMobState = {
  playerId: string;
  baseStats: BaseStats;
  currentHp: number;
  statusEffects: ActiveStatusEffect[];
  mobId: string;
  name: string;
  defeated: boolean;
  imageUrl: string | null;
};

type SanitizedCoopPveState = {
  battleId: string;
  turnNumber: number;
  team: PlayerState[];
  mobs: SanitizedMobState[];
  mode: CoopPveMode;
  status: string;
  result: string;
  turnLog: TurnLogEntry[];
  playerNames: Record<string, string>;
  playerAvatars: Record<string, string | null>;
  playerHouses: Record<string, string>;
  mobNames: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Sanitizar estado para o time (mobs com dados limitados)
// ---------------------------------------------------------------------------

export function sanitizeCoopPveStateForTeam(
  state: CoopPveBattleState,
  playerNames: Record<string, string>,
  playerAvatars: Record<string, string | null>,
  playerHouses: Record<string, string>,
  mobConfigs: CoopPveMobConfig[],
): SanitizedCoopPveState {
  const mobNameMap: Record<string, string> = {};
  for (const mob of state.mobs) {
    const config = mobConfigs.find((c) => c.mobId === mob.mobId);
    mobNameMap[mob.playerId] = config?.name ?? mob.mobId;
  }

  const sanitizedMobs: SanitizedMobState[] = state.mobs.map((mob) => {
    const config = mobConfigs.find((c) => c.mobId === mob.mobId);
    return {
      playerId: mob.playerId,
      baseStats: { ...mob.baseStats },
      currentHp: mob.currentHp,
      statusEffects: [...mob.statusEffects],
      mobId: mob.mobId,
      name: config?.name ?? mob.mobId,
      defeated: mob.defeated,
      imageUrl: config?.imageUrl ?? null,
    };
  });

  return {
    battleId: state.battleId,
    turnNumber: state.turnNumber,
    team: state.team.map((p) => ({ ...p })),
    mobs: sanitizedMobs,
    mode: state.mode,
    status: state.status,
    result: state.result,
    turnLog: [...state.turnLog],
    playerNames,
    playerAvatars,
    playerHouses,
    mobNames: mobNameMap,
  };
}

// ---------------------------------------------------------------------------
// Persistir resultado da coop PvE battle (fire-and-forget)
// ---------------------------------------------------------------------------

async function persistCoopPveResult(session: CoopPveBattleSession): Promise<void> {
  const { state, mobConfigs, battleId } = session;
  const isVictory = state.result === "VICTORY";

  const COOP_EXP_MULTIPLIER = 1.25; // 25% bonus por ser cooperativo

  let totalMobExp = 0;
  if (isVictory) {
    for (const mob of state.mobs) {
      if (mob.defeated) {
        totalMobExp += calculateMobExp(mob.baseStats);
      }
    }
  }
  const playerCount = state.team.length;
  const expPerPlayer = isVictory
    ? Math.floor((totalMobExp * COOP_EXP_MULTIPLIER) / playerCount)
    : 0;

  const playerIds = state.team.map((p) => p.playerId);
  const avgTier = Math.round(
    mobConfigs.reduce((sum, m) => sum + m.tier, 0) / mobConfigs.length
  );

  const modeEnumMap = {
    "2v3": "COOP_2V3",
    "2v5": "COOP_2V5",
    "3v5": "COOP_3V5",
  } as const;
  const modeEnum = modeEnumMap[state.mode];

  await prisma.$transaction(async (tx) => {
    for (const playerId of playerIds) {
      // Atualizar PveBattle record (criado no match:accept)
      await tx.pveBattle.updateMany({
        where: {
          userId: playerId,
          mobId: mobConfigs[0].mobId,
          mode: modeEnum,
          result: null,
        },
        data: {
          result: isVictory ? "VICTORY" : "DEFEAT",
          expGained: expPerPlayer,
          turns: state.turnNumber,
          log: state.turnLog as object[],
        },
      });

      if (isVictory && expPerPlayer > 0) {
        const char = await tx.character.findUnique({
          where: { userId: playerId },
          select: { level: true, currentExp: true, freePoints: true },
        });
        if (char) {
          const gained = calculateExpGained(expPerPlayer, char.level, avgTier);
          const levelResult = processLevelUp({
            level: char.level,
            currentExp: char.currentExp + gained,
            freePoints: char.freePoints,
          });
          await tx.character.update({
            where: { userId: playerId },
            data: {
              level: levelResult.newLevel,
              currentExp: levelResult.newExp,
              freePoints: levelResult.newFreePoints,
            },
          });

          console.log(
            `[Socket.io] Coop PvE ${battleId}: ${playerId} ganhou ${gained} EXP`
          );
        }
      }
    }
  });

  console.log(
    `[Socket.io] Coop PvE ${battleId} persistida. Resultado: ${isVictory ? "VICTORY" : "DEFEAT"}`
  );
}

// ---------------------------------------------------------------------------
// Processar turno (chamado quando todos players vivos enviaram ou timer expirou)
// ---------------------------------------------------------------------------

function processCoopPveTurn(
  io: Server,
  battleId: string,
  session: CoopPveBattleSession,
): void {
  const { state } = session;
  const roomName = `coop-pve-battle:${battleId}`;

  // Montar acoes: players vivos que enviaram + auto-skip para AFK/mortos
  const teamActions: CoopPveAction[] = state.team.map((player) => {
    const pending = session.pendingActions.get(player.playerId);
    if (pending) return pending;

    // Auto-skip para mortos ou AFK
    return {
      playerId: player.playerId,
      skillId: null,
    };
  });

  const result = resolveCoopPveTurn(state, teamActions);
  session.state = result.state;
  session.pendingActions.clear();
  session.lastActivityAt = Date.now();

  const sanitized = sanitizeCoopPveStateForTeam(
    result.state,
    Object.fromEntries(session.playerNames),
    Object.fromEntries(session.playerAvatars),
    Object.fromEntries(session.playerHouses),
    session.mobConfigs,
  );

  if (result.state.status === "FINISHED") {
    io.to(roomName).emit("coop-pve:battle:state", {
      state: sanitized,
      events: result.events,
    });

    // Calcular EXP antes de emitir battle:end
    const COOP_EXP_MULTIPLIER = 1.25;
    let totalMobExp = 0;
    if (result.state.result === "VICTORY") {
      for (const mob of result.state.mobs) {
        if (mob.defeated) {
          totalMobExp += calculateMobExp(mob.baseStats);
        }
      }
    }
    const teamSize = result.state.team.length;
    const expPerPlayer = result.state.result === "VICTORY"
      ? Math.floor((totalMobExp * COOP_EXP_MULTIPLIER) / teamSize)
      : 0;

    io.to(roomName).emit("coop-pve:battle:end", {
      result: result.state.result,
      expGained: expPerPlayer,
    });

    persistCoopPveResult(session).catch((err) => {
      console.log(
        `[Socket.io] Erro ao persistir coop PvE ${battleId}: ${String(err)}`
      );
    });

    readyPlayers.delete(battleId);
    removeCoopPveBattle(battleId);

    console.log(
      `[Socket.io] Coop PvE ${battleId} finalizada. Resultado: ${result.state.result}, EXP/player: ${expPerPlayer}`
    );
  } else {
    io.to(roomName).emit("coop-pve:battle:state", {
      state: sanitized,
      events: result.events,
    });

    startCoopPveTurnTimer(io, battleId, session);
  }
}

// ---------------------------------------------------------------------------
// Timer de turno (30 segundos)
// ---------------------------------------------------------------------------

export function startCoopPveTurnTimer(
  io: Server,
  battleId: string,
  session: CoopPveBattleSession,
): void {
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
  }

  session.turnTimer = setTimeout(() => {
    console.log(
      `[Socket.io] Coop PvE turn timer expirou para batalha ${battleId} (turno ${session.state.turnNumber})`
    );

    processCoopPveTurn(io, battleId, session);
  }, TURN_TIMEOUT_MS);
}

// ---------------------------------------------------------------------------
// Registro de handlers
// ---------------------------------------------------------------------------

export function registerCoopPveBattleHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  // -------------------------------------------------------------------------
  // coop-pve:battle:request-state
  // -------------------------------------------------------------------------

  socket.on("coop-pve:battle:request-state", () => {
    const result = getPlayerCoopPveBattle(userId);
    if (!result) {
      socket.emit("coop-pve:battle:error", {
        message: "Nenhuma batalha coop PvE ativa encontrada",
      });
      return;
    }

    const { battleId, session } = result;

    // Join this socket to the battle room (may be a new socket after reconnect/invite)
    const roomName = `coop-pve-battle:${battleId}`;
    socket.join(roomName);

    // Update socket reference in session
    session.playerSockets.set(userId, socket.id);

    const sanitized = sanitizeCoopPveStateForTeam(
      session.state,
      Object.fromEntries(session.playerNames),
      Object.fromEntries(session.playerAvatars),
      Object.fromEntries(session.playerHouses),
      session.mobConfigs,
    );

    socket.emit("coop-pve:battle:state", {
      state: sanitized,
      events: [],
    });

    // Start turn timer only when ALL alive players have loaded the page.
    if (session.state.status === "IN_PROGRESS" && !session.turnTimer) {
      if (!readyPlayers.has(battleId)) {
        readyPlayers.set(battleId, new Set());
      }
      readyPlayers.get(battleId)!.add(userId);

      const alivePlayers = session.state.team.filter((p) => p.currentHp > 0);
      const allReady = alivePlayers.every((p) =>
        readyPlayers.get(battleId)!.has(p.playerId)
      );
      if (allReady) {
        readyPlayers.delete(battleId);
        startCoopPveTurnTimer(io, battleId, session);
        console.log(
          `[Socket.io] Todos os players carregaram — turn timer coop PvE iniciado para batalha ${battleId}`
        );
      } else {
        console.log(
          `[Socket.io] Player ${userId} carregou coop PvE ${battleId} (${readyPlayers.get(battleId)!.size}/${alivePlayers.length})`
        );
      }
    }
  });

  // -------------------------------------------------------------------------
  // coop-pve:action
  // -------------------------------------------------------------------------

  socket.on("coop-pve:action", (payload: unknown) => {
    // Validar payload
    if (typeof payload !== "object" || payload === null) {
      socket.emit("coop-pve:battle:error", { message: "Payload invalido" });
      return;
    }

    const p = payload as Record<string, unknown>;

    if (typeof p.battleId !== "string") {
      socket.emit("coop-pve:battle:error", {
        message: "battleId deve ser string",
      });
      return;
    }

    if (p.skillId !== null && typeof p.skillId !== "string") {
      socket.emit("coop-pve:battle:error", {
        message: "skillId deve ser string ou null",
      });
      return;
    }

    if (p.targetIndex !== undefined && p.targetIndex !== null && typeof p.targetIndex !== "number") {
      socket.emit("coop-pve:battle:error", {
        message: "targetIndex deve ser number ou undefined",
      });
      return;
    }

    if (p.targetId !== undefined && p.targetId !== null && typeof p.targetId !== "string") {
      socket.emit("coop-pve:battle:error", {
        message: "targetId deve ser string, null ou undefined",
      });
      return;
    }

    const battleId = p.battleId as string;
    const skillId = p.skillId as string | null;
    const targetIndex = p.targetIndex as number | undefined;
    const targetId = p.targetId as string | undefined;

    // Buscar sessao
    const session = getCoopPveBattle(battleId);
    if (!session) {
      socket.emit("coop-pve:battle:error", {
        message: "Batalha coop PvE nao encontrada",
      });
      return;
    }

    // Verificar player pertence
    if (!session.playerSockets.has(userId)) {
      socket.emit("coop-pve:battle:error", {
        message: "Voce nao pertence a esta batalha coop PvE",
      });
      return;
    }

    // Verificar status IN_PROGRESS
    if (session.state.status !== "IN_PROGRESS") {
      socket.emit("coop-pve:battle:error", {
        message: "Batalha coop PvE nao esta em progresso",
      });
      return;
    }

    // Verificar player vivo
    const playerState = session.state.team.find(
      (pl) => pl.playerId === userId
    );
    if (!playerState || playerState.currentHp <= 0) {
      socket.emit("coop-pve:battle:error", {
        message: "Seu personagem esta morto",
      });
      return;
    }

    // Verificar acao duplicada
    if (session.pendingActions.has(userId)) {
      socket.emit("coop-pve:battle:error", {
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
        socket.emit("coop-pve:battle:error", {
          message: "Skill nao equipada",
        });
        return;
      }

      if (
        playerState.cooldowns[skillId] &&
        playerState.cooldowns[skillId] > 0
      ) {
        socket.emit("coop-pve:battle:error", {
          message: "Skill em cooldown",
        });
        return;
      }
    }

    // Armazenar acao
    const action: CoopPveAction = { playerId: userId, skillId, targetIndex, targetId };
    session.pendingActions.set(userId, action);
    session.lastActivityAt = Date.now();

    const roomName = `coop-pve-battle:${battleId}`;
    io.to(roomName).emit("coop-pve:action:received", {
      playerId: userId,
      total: session.pendingActions.size,
      expected: session.state.team.filter((pl) => pl.currentHp > 0).length,
    });

    console.log(
      `[Socket.io] ${userId} enviou acao na coop PvE ${battleId} (skill: ${skillId ?? "skip"}, targetIndex: ${targetIndex ?? "N/A"}, targetId: ${targetId ?? "N/A"})`
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
      processCoopPveTurn(io, battleId, session);
    }
  });

  // -------------------------------------------------------------------------
  // disconnect
  // -------------------------------------------------------------------------

  socket.on("disconnect", () => {
    const result = getPlayerCoopPveBattle(userId);
    if (!result) return;

    const { battleId, session } = result;

    // Ignorar se match ainda pendente (tratado pelo coop-pve-matchmaking handler)
    if (session.matchTimer) return;

    // Ignorar se batalha ja terminou
    if (session.state.status !== "IN_PROGRESS") return;

    const roomName = `coop-pve-battle:${battleId}`;

    // Iniciar grace period
    const disconnectTimer = setTimeout(() => {
      const currentSession = getCoopPveBattle(battleId);
      if (!currentSession) return;

      // Se o player reconectou durante o grace, o timer foi limpo
      if (!currentSession.disconnectedPlayers.has(userId)) return;

      currentSession.disconnectedPlayers.delete(userId);

      // Marcar player como morto (desconexao permanente = eliminado)
      const disconnectedPlayer = currentSession.state.team.find(
        (p) => p.playerId === userId,
      );
      if (disconnectedPlayer) {
        disconnectedPlayer.currentHp = 0;
      }

      // Verificar se ainda restam players vivos e conectados
      const aliveAndConnected = currentSession.state.team.filter(
        (p) =>
          p.currentHp > 0 &&
          !currentSession.disconnectedPlayers.has(p.playerId),
      );

      if (aliveAndConnected.length === 0) {
        // Todos mortos ou desconectados — encerrar como derrota
        currentSession.state.status = "FINISHED";
        currentSession.state.result = "DEFEAT";

        if (currentSession.turnTimer) {
          clearTimeout(currentSession.turnTimer);
          currentSession.turnTimer = null;
        }

        io.to(roomName).emit("coop-pve:battle:end", {
          result: "DEFEAT",
          message: "Todos os aliados desconectaram. Batalha encerrada.",
        });

        persistCoopPveResult(currentSession).catch((err) => {
          console.log(
            `[Socket.io] Erro ao persistir coop PvE ${battleId} (desconexao permanente de ${userId}): ${String(err)}`
          );
        });

        readyPlayers.delete(battleId);
        removeCoopPveBattle(battleId);
        console.log(
          `[Socket.io] Coop PvE ${battleId} encerrada: todos desconectaram permanentemente`
        );
      } else {
        // Ainda ha players vivos — notificar e continuar
        io.to(roomName).emit("coop-pve:battle:player-eliminated", {
          playerId: userId,
          message: "Aliado desconectou permanentemente e foi eliminado.",
        });

        console.log(
          `[Socket.io] ${userId} eliminado da coop PvE ${battleId} por desconexao permanente. ${aliveAndConnected.length} player(s) restante(s).`
        );
      }
    }, RECONNECT_GRACE_MS);

    session.disconnectedPlayers.set(userId, { disconnectTimer });
    session.lastActivityAt = Date.now();

    io.to(roomName).emit("coop-pve:battle:player-disconnected", {
      playerId: userId,
      gracePeriodMs: RECONNECT_GRACE_MS,
    });

    console.log(
      `[Socket.io] ${userId} desconectou da coop PvE ${battleId}. Grace period de ${RECONNECT_GRACE_MS / 1000}s iniciado.`
    );
  });
}

// ---------------------------------------------------------------------------
// Reconexao de jogador desconectado em coop PvE battle
// ---------------------------------------------------------------------------

export function handleCoopPveReconnection(
  io: Server,
  socket: Socket,
  userId: string,
): boolean {
  const result = getPlayerCoopPveBattle(userId);
  if (!result) return false;

  const { battleId, session } = result;

  const disconnectEntry = session.disconnectedPlayers.get(userId);
  if (!disconnectEntry) return false;

  // Limpar disconnect timer
  clearTimeout(disconnectEntry.disconnectTimer);
  session.disconnectedPlayers.delete(userId);

  // Atualizar socketId
  updateCoopPvePlayerSocket(battleId, userId, socket.id);

  // Join room
  const roomName = `coop-pve-battle:${battleId}`;
  socket.join(roomName);

  session.lastActivityAt = Date.now();

  // Notificar sala
  io.to(roomName).emit("coop-pve:battle:player-reconnected", {
    playerId: userId,
  });

  // Enviar estado atual para o jogador reconectado
  socket.emit("coop-pve:battle:state", {
    state: sanitizeCoopPveStateForTeam(
      session.state,
      Object.fromEntries(session.playerNames),
      Object.fromEntries(session.playerAvatars),
      Object.fromEntries(session.playerHouses),
      session.mobConfigs,
    ),
    events: [],
  });

  console.log(
    `[Socket.io] ${userId} reconectou na coop PvE ${battleId}. Batalha retomada.`
  );

  return true;
}
