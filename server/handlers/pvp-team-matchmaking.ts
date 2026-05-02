// server/handlers/pvp-team-matchmaking.ts — Fila e emparelhamento para PvP Team 2v2

import crypto from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { BaseStats, EquippedSkill } from "../../lib/battle/types";
import type { PvpTeamBattleConfig, PvpTeamBattleSession } from "../../lib/battle/pvp-team-types";
import { convertToEquippedSkills, extractBaseStats, CHARACTER_SKILLS_SELECT } from "../lib/convert-skills";
import { loadEquippedCardsAndApply } from "../../lib/cards/load-equipped";
import { initPvpTeamBattle } from "../../lib/battle/pvp-team-turn";
import { isInQueue } from "../stores/queue-store";
import { getPlayerBattle } from "../stores/pvp-store";
import { isInBossQueue } from "../stores/boss-queue-store";
import { getPlayerBossBattle } from "../stores/boss-battle-store";
import { isInCoopPveQueue } from "../stores/coop-pve-queue-store";
import { getPlayerCoopPveBattle } from "../stores/coop-pve-battle-store";
import {
  addToSoloQueue,
  removeFromSoloQueue,
  findSoloMatch,
  getSoloQueuePosition,
  getSoloQueueSize,
  isInAnyQueue,
  removeFromAnyQueue,
} from "../stores/pvp-team-queue-store";
import {
  setPvpTeamBattle,
  getPvpTeamBattle,
  removePvpTeamBattle,
  getPlayerPvpTeamBattle,
} from "../stores/pvp-team-battle-store";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MATCH_ACCEPT_TIMEOUT_MS = 30_000;
const QUEUE_TIMEOUT_MS = 5 * 60_000;

// Timers de queue timeout por userId (compartilhado entre handlers e disconnect)
const queueTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isValidBattleIdPayload(payload: unknown): payload is { battleId: string } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.battleId === "string" && p.battleId.length > 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlayerBusy(userId: string): string | null {
  if (isInQueue(userId)) return "Voce ja esta na fila de PvP 1v1";
  if (isInBossQueue(userId)) return "Voce ja esta na fila de boss fight";
  if (isInCoopPveQueue(userId)) return "Voce ja esta na fila de batalha coop PvE";
  if (isInAnyQueue(userId)) return "Voce ja esta na fila de PvP Team";
  if (getPlayerBattle(userId)) return "Voce ja esta em uma batalha PvP ativa";
  if (getPlayerBossBattle(userId)) return "Voce ja esta em uma boss fight ativa";
  if (getPlayerCoopPveBattle(userId)) return "Voce ja esta em uma batalha coop PvE ativa";
  if (getPlayerPvpTeamBattle(userId)) return "Voce ja esta em uma batalha PvP Team ativa";
  return null;
}

/** Fisher-Yates shuffle in-place */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Criar sessao de batalha PvP Team a partir de 4 jogadores matched
// ---------------------------------------------------------------------------

type MatchedPlayer = {
  userId: string;
  socketId: string;
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
  spectralSkill?: { skill: import("../../lib/battle/types").Skill; sourceUserCardId: string };
};

async function createPvpTeamSession(
  io: Server,
  matched: MatchedPlayer[]
): Promise<{ battleId: string; session: PvpTeamBattleSession }> {
  // Shuffle e dividir em 2 times
  const shuffled = shuffle([...matched]);
  const team1Players = shuffled.slice(0, 2);
  const team2Players = shuffled.slice(2, 4);

  const battleId = crypto.randomUUID();

  const battleConfig: PvpTeamBattleConfig = {
    battleId,
    team1: team1Players.map((p) => ({
      userId: p.userId,
      characterId: p.characterId,
      stats: p.stats,
      skills: p.skills,
      spectralSkill: p.spectralSkill,
    })),
    team2: team2Players.map((p) => ({
      userId: p.userId,
      characterId: p.characterId,
      stats: p.stats,
      skills: p.skills,
      spectralSkill: p.spectralSkill,
    })),
    mode: "TEAM_2V2",
  };

  const state = initPvpTeamBattle(battleConfig);

  // Buscar nomes/avatars/houses dos 4 players
  const users = await prisma.user.findMany({
    where: { id: { in: matched.map((e) => e.userId) } },
    select: { id: true, name: true, avatarUrl: true, house: { select: { name: true } } },
  });

  const playerTeams = new Map<string, 1 | 2>();
  for (const p of team1Players) playerTeams.set(p.userId, 1);
  for (const p of team2Players) playerTeams.set(p.userId, 2);

  const session: PvpTeamBattleSession = {
    battleId,
    state,
    playerSockets: new Map(matched.map((e) => [e.userId, e.socketId])),
    playerNames: new Map(users.map((u) => [u.id, u.name])),
    playerAvatars: new Map(users.map((u) => [u.id, u.avatarUrl])),
    playerHouses: new Map(users.map((u) => [u.id, u.house?.name ?? ""])),
    playerTeams,
    pendingActions: new Map(),
    turnTimer: null,
    matchAccepted: new Set(),
    matchTimer: null,
    disconnectedPlayers: new Map(),
    autoSkipPlayers: new Set(),
    lastActivityAt: Date.now(),
  };

  setPvpTeamBattle(battleId, session);

  return { battleId, session };
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export function registerPvpTeamMatchmakingHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  // -------------------------------------------------------------------------
  // pvp-team:queue:join — entrar na fila solo
  // -------------------------------------------------------------------------

  socket.on("pvp-team:queue:join", async () => {
    // Verificar que nao esta em nenhuma outra fila/batalha ativa
    const busyMsg = isPlayerBusy(userId);
    if (busyMsg) {
      socket.emit("pvp-team:queue:error", { message: busyMsg });
      return;
    }

    // Buscar character do banco com skills equipadas
    const character = await prisma.character.findUnique({
      where: { userId },
      select: {
        id: true,
        physicalAtk: true,
        physicalDef: true,
        magicAtk: true,
        magicDef: true,
        hp: true,
        speed: true,
        level: true,
        characterSkills: CHARACTER_SKILLS_SELECT,
      },
    });

    if (!character || character.characterSkills.length === 0) {
      socket.emit("pvp-team:queue:error", {
        message: "Personagem nao encontrado ou sem skills equipadas",
      });
      return;
    }

    const equipped = await loadEquippedCardsAndApply(
      prisma,
      userId,
      extractBaseStats(character),
    );
    const stats: BaseStats = equipped.baseStats;
    const skills: EquippedSkill[] = convertToEquippedSkills(character.characterSkills);
    const spectralSkill = equipped.spectralSkill;

    const added = addToSoloQueue({
      userId,
      socketId: socket.id,
      characterId: character.id,
      stats,
      skills,
      spectralSkill,
      joinedAt: Date.now(),
    });

    if (!added) {
      socket.emit("pvp-team:queue:error", {
        message: "Nao foi possivel entrar na fila",
      });
      return;
    }

    const position = getSoloQueuePosition(userId);
    const size = getSoloQueueSize();

    socket.emit("pvp-team:queue:status", {
      position,
      size,
    });

    console.log(
      `[Socket.io] ${userId} entrou na fila PvP Team 2v2 solo. Posicao: ${position}/${size}`
    );

    // Setar queue timeout (5 min)
    const queueTimer = setTimeout(() => {
      removeFromSoloQueue(userId);
      queueTimeouts.delete(userId);
      socket.emit("pvp-team:queue:timeout", {
        message: "Tempo na fila expirou. Tente novamente.",
      });
      console.log(`[Socket.io] ${userId} removido da fila PvP Team por timeout`);
    }, QUEUE_TIMEOUT_MS);

    queueTimeouts.set(userId, queueTimer);

    // Tentar match (4 jogadores solo)
    const matched = findSoloMatch();
    if (!matched) return;

    // Limpar queueTimeouts dos 4 jogadores
    for (const entry of matched) {
      const timer = queueTimeouts.get(entry.userId);
      if (timer) {
        clearTimeout(timer);
        queueTimeouts.delete(entry.userId);
      }
    }

    // Criar sessao
    const { battleId, session } = await createPvpTeamSession(io, matched);

    // Emitir pvp-team:match:found para os 4 sockets
    for (const entry of matched) {
      const playerSocket = io.sockets.sockets.get(entry.socketId);
      if (playerSocket) {
        const myTeam = session.playerTeams.get(entry.userId) ?? 1;
        const allPlayerIds = Array.from(session.playerSockets.keys());

        const teammates = allPlayerIds
          .filter((id) => id !== entry.userId && session.playerTeams.get(id) === myTeam)
          .map((id) => ({
            userId: id,
            name: session.playerNames.get(id) ?? "",
          }));

        const opponents = allPlayerIds
          .filter((id) => session.playerTeams.get(id) !== myTeam)
          .map((id) => ({
            userId: id,
            name: session.playerNames.get(id) ?? "",
          }));

        playerSocket.emit("pvp-team:match:found", {
          battleId,
          myTeam,
          teammates,
          opponents,
          acceptTimeoutMs: MATCH_ACCEPT_TIMEOUT_MS,
        });
      }
    }

    console.log(
      `[Socket.io] PvP Team match encontrado: ${matched.map((m) => m.userId).join(", ")} -> batalha ${battleId}`
    );

    // Setar match accept timer (30s)
    const matchTimer = setTimeout(() => {
      const currentSession = getPvpTeamBattle(battleId);
      if (!currentSession) return;

      // Quem nao aceitou recebe timeout
      for (const [pUserId, pSocketId] of currentSession.playerSockets) {
        const pSocket = io.sockets.sockets.get(pSocketId);
        if (!currentSession.matchAccepted.has(pUserId)) {
          pSocket?.emit("pvp-team:match:timeout", {
            message: "Tempo para aceitar expirou",
          });
        }
      }

      // Devolver quem aceitou para a fila solo
      for (const acceptedUserId of currentSession.matchAccepted) {
        const originalEntry = matched.find((m) => m.userId === acceptedUserId);
        if (originalEntry) {
          originalEntry.socketId =
            currentSession.playerSockets.get(acceptedUserId) ?? originalEntry.socketId;
          addToSoloQueue({
            ...originalEntry,
            joinedAt: Date.now(),
          });
          const acceptedSocket = io.sockets.sockets.get(
            currentSession.playerSockets.get(acceptedUserId) ?? ""
          );
          acceptedSocket?.emit("pvp-team:match:cancelled", {
            message: "Um jogador nao aceitou a tempo. Voce foi devolvido a fila.",
          });
        }
      }

      removePvpTeamBattle(battleId);
      console.log(
        `[Socket.io] PvP Team match ${battleId} cancelado por timeout de aceite`
      );
    }, MATCH_ACCEPT_TIMEOUT_MS);

    session.matchTimer = matchTimer;
  });

  // -------------------------------------------------------------------------
  // pvp-team:queue:leave
  // -------------------------------------------------------------------------

  socket.on("pvp-team:queue:leave", () => {
    const timer = queueTimeouts.get(userId);
    if (timer) {
      clearTimeout(timer);
      queueTimeouts.delete(userId);
    }

    removeFromAnyQueue(userId);
    socket.emit("pvp-team:queue:left", {
      message: "Saiu da fila de PvP Team",
    });
    console.log(`[Socket.io] ${userId} saiu da fila PvP Team`);
  });

  // -------------------------------------------------------------------------
  // pvp-team:match:accept
  // -------------------------------------------------------------------------

  socket.on("pvp-team:match:accept", async (payload: unknown) => {
    if (!isValidBattleIdPayload(payload)) {
      socket.emit("pvp-team:queue:error", {
        message: "Payload invalido para pvp-team:match:accept",
      });
      return;
    }

    const { battleId } = payload;
    const session = getPvpTeamBattle(battleId);

    if (!session) {
      socket.emit("pvp-team:queue:error", {
        message: "Sessao de PvP Team nao encontrada",
      });
      return;
    }

    if (!session.playerSockets.has(userId)) {
      socket.emit("pvp-team:queue:error", {
        message: "Voce nao pertence a esta sessao",
      });
      return;
    }

    if (session.matchAccepted.has(userId)) {
      socket.emit("pvp-team:queue:error", {
        message: "Voce ja aceitou esta batalha PvP Team",
      });
      return;
    }

    session.matchAccepted.add(userId);
    session.lastActivityAt = Date.now();

    const requiredAccepts = 4;
    if (session.matchAccepted.size >= requiredAccepts) {
      // Todos aceitaram
      if (session.matchTimer) {
        clearTimeout(session.matchTimer);
        session.matchTimer = null;
      }

      // Joinar sockets na room
      const roomName = `pvp-team-battle:${battleId}`;
      for (const [, pSocketId] of session.playerSockets) {
        const pSocket = io.sockets.sockets.get(pSocketId);
        pSocket?.join(roomName);
      }

      // Persistir TeamBattle + TeamBattleParticipant no banco
      const allPlayerIds = Array.from(session.playerSockets.keys());
      prisma.teamBattle
        .create({
          data: {
            id: battleId,
            mode: "TEAM_2V2",
            status: "IN_PROGRESS",
            participants: {
              create: allPlayerIds.map((pUserId) => {
                const teamNum = session.playerTeams.get(pUserId) ?? 1;
                const teamPlayers = teamNum === 1 ? session.state.team1 : session.state.team2;
                const playerState = teamPlayers.find((p) => p.playerId === pUserId);
                return {
                  userId: pUserId,
                  characterId: playerState?.characterId ?? "",
                  team: teamNum,
                };
              }),
            },
          },
        })
        .catch((err: unknown) => {
          console.log(
            `[Socket.io] Erro ao persistir TeamBattle ${battleId}: ${String(err)}`
          );
        });

      // Emitir pvp-team:battle:start
      io.to(roomName).emit("pvp-team:battle:start", {
        battleId,
      });

      console.log(`[Socket.io] PvP Team battle ${battleId} iniciada`);
    } else {
      // Notificar contagem
      const socketIds = Array.from(session.playerSockets.values());
      io.to(socketIds).emit("pvp-team:match:accepted", {
        accepted: session.matchAccepted.size,
        total: requiredAccepts,
      });
    }
  });

  // -------------------------------------------------------------------------
  // pvp-team:match:decline
  // -------------------------------------------------------------------------

  socket.on("pvp-team:match:decline", (payload: unknown) => {
    if (!isValidBattleIdPayload(payload)) {
      socket.emit("pvp-team:queue:error", {
        message: "Payload invalido para pvp-team:match:decline",
      });
      return;
    }

    const { battleId } = payload;
    const session = getPvpTeamBattle(battleId);

    if (!session) return;
    if (!session.playerSockets.has(userId)) return;

    // Cancelar matchTimer
    if (session.matchTimer) {
      clearTimeout(session.matchTimer);
      session.matchTimer = null;
    }

    // Notificar os outros jogadores
    for (const [pUserId, pSocketId] of session.playerSockets) {
      if (pUserId === userId) continue;
      const pSocket = io.sockets.sockets.get(pSocketId);
      pSocket?.emit("pvp-team:match:cancelled", {
        message: "Um jogador recusou a batalha PvP Team.",
      });

      // Devolver quem aceitou para a fila solo
      if (session.matchAccepted.has(pUserId)) {
        const teamNum = session.playerTeams.get(pUserId) ?? 1;
        const teamPlayers = teamNum === 1 ? session.state.team1 : session.state.team2;
        const playerState = teamPlayers.find((p) => p.playerId === pUserId);
        if (playerState) {
          addToSoloQueue({
            userId: pUserId,
            socketId: pSocketId,
            characterId: playerState.characterId,
            stats: playerState.baseStats,
            skills: playerState.equippedSkills,
            joinedAt: Date.now(),
          });
        }
      }
    }

    removePvpTeamBattle(battleId);
    console.log(
      `[Socket.io] PvP Team match ${battleId} cancelado: ${userId} recusou`
    );
  });

  // disconnect cleanup centralizado em handlePvpTeamMatchmakingDisconnect
}

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

export function handlePvpTeamMatchmakingDisconnect(
  io: Server,
  _socket: Socket,
  userId: string,
): void {
  // Se na fila: remover + limpar timeout
  const timer = queueTimeouts.get(userId);
  if (timer) {
    clearTimeout(timer);
    queueTimeouts.delete(userId);
  }
  removeFromAnyQueue(userId);

  // Se em match pendente: tratar como decline
  const result = getPlayerPvpTeamBattle(userId);
  if (result && result.session.matchTimer) {
    const { battleId, session } = result;

    if (session.matchTimer) {
      clearTimeout(session.matchTimer);
      session.matchTimer = null;
    }

    for (const [pUserId, pSocketId] of session.playerSockets) {
      if (pUserId === userId) continue;
      const pSocket = io.sockets.sockets.get(pSocketId);
      pSocket?.emit("pvp-team:match:cancelled", {
        message: "Um jogador desconectou durante a selecao.",
      });

      if (session.matchAccepted.has(pUserId)) {
        const teamNum = session.playerTeams.get(pUserId) ?? 1;
        const teamPlayers = teamNum === 1 ? session.state.team1 : session.state.team2;
        const playerState = teamPlayers.find((p) => p.playerId === pUserId);
        if (playerState) {
          addToSoloQueue({
            userId: pUserId,
            socketId: pSocketId,
            characterId: playerState.characterId,
            stats: playerState.baseStats,
            skills: playerState.equippedSkills,
            joinedAt: Date.now(),
          });
        }
      }
    }

    removePvpTeamBattle(battleId);
    console.log(
      `[Socket.io] PvP Team match ${battleId} cancelado: ${userId} desconectou durante aceite`
    );
  }
  // Batalha ativa: delegado para pvp-team-battle handler via disconnect
}

// ---------------------------------------------------------------------------
// Export para uso no invite handler (duo queue match)
// ---------------------------------------------------------------------------

export { createPvpTeamSession, isPlayerBusy };
export type { MatchedPlayer };
