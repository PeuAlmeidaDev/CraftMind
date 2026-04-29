// server/handlers/pvp-team-invite.ts — Convites de amigos para formar dupla no PvP Team 2v2

import crypto from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { BaseStats, EquippedSkill } from "../../lib/battle/types";
import { convertToEquippedSkills, extractBaseStats, CHARACTER_SKILLS_SELECT } from "../lib/convert-skills";
import { loadEquippedCardsAndApply } from "../../lib/cards/load-equipped";
import { isOnline, getSocketIds } from "../stores/user-store";
import {
  setInvite as setPvpTeamInvite,
  getInvite as getPvpTeamInvite,
  removeInvite as removePvpTeamInvite,
  getInviteBySender,
  getInviteByTarget,
  removeInvitesBySender,
  removeInvitesByTarget,
} from "../stores/pvp-team-invite-store";
import {
  addToDuoQueue,
  findDuoMatch,
} from "../stores/pvp-team-queue-store";
import type { PvpTeamDuoEntry } from "../stores/pvp-team-queue-store";
import {
  createPvpTeamSession,
  isPlayerBusy,
} from "./pvp-team-matchmaking";
import type { MatchedPlayer } from "./pvp-team-matchmaking";
import {
  getPvpTeamBattle,
  removePvpTeamBattle,
} from "../stores/pvp-team-battle-store";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const INVITE_TTL_MS = 30_000;
const MATCH_ACCEPT_TIMEOUT_MS = 30_000;
const MAX_ONLINE_CHECK_IDS = 50;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isValidSendPayload(
  payload: unknown
): payload is { targetUserId: string } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.targetUserId === "string" && p.targetUserId.length > 0;
}

function isValidInviteIdPayload(
  payload: unknown
): payload is { inviteId: string } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.inviteId === "string" && p.inviteId.length > 0;
}

function isValidOnlineCheckPayload(
  payload: unknown
): payload is { userIds: string[] } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p.userIds)) return false;
  if (p.userIds.length === 0 || p.userIds.length > MAX_ONLINE_CHECK_IDS) return false;
  return p.userIds.every((id: unknown) => typeof id === "string" && (id as string).length > 0);
}

function isValidBattleIdPayload(payload: unknown): payload is { battleId: string } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.battleId === "string" && p.battleId.length > 0;
}

// ---------------------------------------------------------------------------
// Helper: emitir para todos os sockets de um userId
// ---------------------------------------------------------------------------

function emitToUser(io: Server, userId: string, event: string, payload: unknown): void {
  const socketIds = getSocketIds(userId);
  if (!socketIds) return;
  for (const socketId of socketIds) {
    io.to(socketId).emit(event, payload);
  }
}

// ---------------------------------------------------------------------------
// Helper: quando duas duplas sao encontradas na duo queue, criar match
// ---------------------------------------------------------------------------

async function handleDuoMatch(
  io: Server,
  duoMatch: PvpTeamDuoEntry[]
): Promise<void> {
  const [duo1, duo2] = duoMatch;

  // Montar matched players: duo1 = time 1, duo2 = time 2
  const matched: MatchedPlayer[] = [
    duo1.player1,
    duo1.player2,
    duo2.player1,
    duo2.player2,
  ];

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
    `[Socket.io] PvP Team duo match encontrado: ${matched.map((m) => m.userId).join(", ")} -> batalha ${battleId}`
  );

  // Setar match accept timer (30s)
  const matchTimer = setTimeout(() => {
    const currentSession = getPvpTeamBattle(battleId);
    if (!currentSession) return;

    for (const [pUserId, pSocketId] of currentSession.playerSockets) {
      const pSocket = io.sockets.sockets.get(pSocketId);
      if (!currentSession.matchAccepted.has(pUserId)) {
        pSocket?.emit("pvp-team:match:timeout", {
          message: "Tempo para aceitar expirou",
        });
      } else {
        pSocket?.emit("pvp-team:match:cancelled", {
          message: "Um jogador nao aceitou a tempo.",
        });
      }
    }

    removePvpTeamBattle(battleId);
    console.log(
      `[Socket.io] PvP Team duo match ${battleId} cancelado por timeout de aceite`
    );
  }, MATCH_ACCEPT_TIMEOUT_MS);

  session.matchTimer = matchTimer;
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export function registerPvpTeamInviteHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  // -------------------------------------------------------------------------
  // pvp-team:invite:send
  // -------------------------------------------------------------------------

  socket.on("pvp-team:invite:send", async (payload: unknown) => {
    if (!isValidSendPayload(payload)) {
      socket.emit("pvp-team:invite:error", {
        message: "Payload invalido para pvp-team:invite:send",
      });
      return;
    }

    const { targetUserId } = payload;

    // Nao pode convidar a si mesmo
    if (targetUserId === userId) {
      socket.emit("pvp-team:invite:error", {
        message: "Voce nao pode convidar a si mesmo",
      });
      return;
    }

    // Sender nao pode estar em fila/batalha
    const senderBusy = isPlayerBusy(userId);
    if (senderBusy) {
      socket.emit("pvp-team:invite:error", { message: senderBusy });
      return;
    }

    // Sender ja tem convite pendente
    if (getInviteBySender(userId)) {
      socket.emit("pvp-team:invite:error", {
        message: "Voce ja tem um convite PvP Team pendente",
      });
      return;
    }

    // Target deve estar online
    if (!isOnline(targetUserId)) {
      socket.emit("pvp-team:invite:error", {
        message: "O jogador nao esta online",
      });
      return;
    }

    // Target nao pode estar em fila/batalha
    const targetBusy = isPlayerBusy(targetUserId);
    if (targetBusy) {
      socket.emit("pvp-team:invite:error", {
        message: "O jogador esta ocupado em uma fila ou batalha",
      });
      return;
    }

    // Target nao pode ter convite PvP Team pendente (como target)
    if (getInviteByTarget(targetUserId)) {
      socket.emit("pvp-team:invite:error", {
        message: "O jogador ja tem um convite PvP Team pendente",
      });
      return;
    }

    // Verificar amizade aceita
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId },
        ],
      },
    });

    if (!friendship) {
      socket.emit("pvp-team:invite:error", {
        message: "Voce so pode convidar amigos para PvP Team",
      });
      return;
    }

    // Verificar que sender tem character com skills
    const character = await prisma.character.findUnique({
      where: { userId },
      select: {
        id: true,
        characterSkills: CHARACTER_SKILLS_SELECT,
      },
    });

    if (!character || character.characterSkills.length === 0) {
      socket.emit("pvp-team:invite:error", {
        message: "Voce precisa ter pelo menos 1 skill equipada",
      });
      return;
    }

    // Buscar nome do sender
    const senderUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!senderUser) {
      socket.emit("pvp-team:invite:error", {
        message: "Erro ao buscar dados do usuario",
      });
      return;
    }

    // Criar convite
    const inviteId = crypto.randomUUID();

    const timer = setTimeout(() => {
      const expiredInvite = getPvpTeamInvite(inviteId);
      if (!expiredInvite) return;

      removePvpTeamInvite(inviteId);
      emitToUser(io, userId, "pvp-team:invite:expired", { inviteId });
      emitToUser(io, targetUserId, "pvp-team:invite:expired", { inviteId });

      console.log(
        `[Socket.io] PvP Team invite ${inviteId} expirou (${userId} -> ${targetUserId})`
      );
    }, INVITE_TTL_MS);

    setPvpTeamInvite({
      inviteId,
      senderId: userId,
      senderSocketId: socket.id,
      senderName: senderUser.name,
      targetId: targetUserId,
      createdAt: Date.now(),
      timer,
    });

    // Notificar target
    emitToUser(io, targetUserId, "pvp-team:invite:received", {
      inviteId,
      from: { userId, name: senderUser.name },
    });

    // Confirmar para sender
    socket.emit("pvp-team:invite:sent", {
      inviteId,
      targetUserId,
    });

    console.log(
      `[Socket.io] PvP Team invite ${inviteId}: ${userId} -> ${targetUserId}`
    );
  });

  // -------------------------------------------------------------------------
  // pvp-team:invite:accept
  // -------------------------------------------------------------------------

  socket.on("pvp-team:invite:accept", async (payload: unknown) => {
    if (!isValidInviteIdPayload(payload)) {
      socket.emit("pvp-team:invite:error", {
        message: "Payload invalido para pvp-team:invite:accept",
      });
      return;
    }

    const { inviteId } = payload;
    const invite = getPvpTeamInvite(inviteId);

    if (!invite) {
      socket.emit("pvp-team:invite:error", {
        message: "Convite nao encontrado ou expirado",
      });
      return;
    }

    // Apenas o target pode aceitar
    if (invite.targetId !== userId) {
      socket.emit("pvp-team:invite:error", {
        message: "Voce nao e o destinatario deste convite",
      });
      return;
    }

    // Target nao pode estar busy
    const targetBusy = isPlayerBusy(userId);
    if (targetBusy) {
      socket.emit("pvp-team:invite:error", { message: targetBusy });
      removePvpTeamInvite(inviteId);
      emitToUser(io, invite.senderId, "pvp-team:invite:expired", { inviteId });
      return;
    }

    // Sender nao pode estar busy
    const senderBusy = isPlayerBusy(invite.senderId);
    if (senderBusy) {
      socket.emit("pvp-team:invite:error", {
        message: "O jogador que convidou esta ocupado agora",
      });
      removePvpTeamInvite(inviteId);
      return;
    }

    // Sender deve estar online
    if (!isOnline(invite.senderId)) {
      socket.emit("pvp-team:invite:error", {
        message: "O jogador que convidou nao esta mais online",
      });
      removePvpTeamInvite(inviteId);
      return;
    }

    // Remover convite
    removePvpTeamInvite(inviteId);

    const { senderId } = invite;

    // Buscar characters dos 2 players com skills
    const characters = await prisma.character.findMany({
      where: { userId: { in: [senderId, userId] } },
      select: {
        id: true,
        userId: true,
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

    if (characters.length !== 2) {
      socket.emit("pvp-team:invite:error", {
        message: "Um dos jogadores nao tem personagem",
      });
      emitToUser(io, senderId, "pvp-team:invite:error", {
        message: "Nao foi possivel formar a dupla: personagem nao encontrado",
      });
      return;
    }

    for (const char of characters) {
      if (char.characterSkills.length === 0) {
        socket.emit("pvp-team:invite:error", {
          message: "Um dos jogadores nao tem skills equipadas",
        });
        emitToUser(io, senderId, "pvp-team:invite:error", {
          message: "Nao foi possivel formar a dupla: jogador sem skills",
        });
        return;
      }
    }

    // Determinar sockets atuais
    const senderSocketIds = getSocketIds(senderId);
    const targetSocketIds = getSocketIds(userId);
    const senderSocketId = senderSocketIds ? Array.from(senderSocketIds)[0] : invite.senderSocketId;
    const targetSocketId = targetSocketIds ? Array.from(targetSocketIds)[0] : socket.id;

    // Criar entradas para duo queue
    const senderChar = characters.find((c) => c.userId === senderId)!;
    const targetChar = characters.find((c) => c.userId === userId)!;

    const senderEntry = {
      userId: senderId,
      socketId: senderSocketId,
      characterId: senderChar.id,
      stats: (await loadEquippedCardsAndApply(
        prisma,
        senderId,
        extractBaseStats(senderChar),
      )) as BaseStats,
      skills: convertToEquippedSkills(senderChar.characterSkills) as EquippedSkill[],
      joinedAt: Date.now(),
    };

    const targetEntry = {
      userId,
      socketId: targetSocketId,
      characterId: targetChar.id,
      stats: (await loadEquippedCardsAndApply(
        prisma,
        userId,
        extractBaseStats(targetChar),
      )) as BaseStats,
      skills: convertToEquippedSkills(targetChar.characterSkills) as EquippedSkill[],
      joinedAt: Date.now(),
    };

    const duoEntry: PvpTeamDuoEntry = {
      player1: senderEntry,
      player2: targetEntry,
      joinedAt: Date.now(),
    };

    const added = addToDuoQueue(duoEntry);
    if (!added) {
      socket.emit("pvp-team:invite:error", {
        message: "Nao foi possivel entrar na fila de duplas",
      });
      emitToUser(io, senderId, "pvp-team:invite:error", {
        message: "Nao foi possivel entrar na fila de duplas",
      });
      return;
    }

    // Notificar ambos que estao na fila de duplas
    emitToUser(io, senderId, "pvp-team:queue:status", {
      message: "Dupla formada! Aguardando outra dupla na fila...",
      isDuo: true,
    });
    emitToUser(io, userId, "pvp-team:queue:status", {
      message: "Dupla formada! Aguardando outra dupla na fila...",
      isDuo: true,
    });

    console.log(
      `[Socket.io] PvP Team duo formada: ${senderId} + ${userId}. Entraram na fila de duplas.`
    );

    // Tentar match com outra dupla
    const duoMatch = findDuoMatch();
    if (!duoMatch) return;

    await handleDuoMatch(io, duoMatch);
  });

  // -------------------------------------------------------------------------
  // pvp-team:invite:decline
  // -------------------------------------------------------------------------

  socket.on("pvp-team:invite:decline", (payload: unknown) => {
    if (!isValidInviteIdPayload(payload)) {
      socket.emit("pvp-team:invite:error", {
        message: "Payload invalido para pvp-team:invite:decline",
      });
      return;
    }

    const { inviteId } = payload;
    const invite = getPvpTeamInvite(inviteId);

    if (!invite) {
      socket.emit("pvp-team:invite:error", {
        message: "Convite nao encontrado ou expirado",
      });
      return;
    }

    if (invite.targetId !== userId) {
      socket.emit("pvp-team:invite:error", {
        message: "Voce nao e o destinatario deste convite",
      });
      return;
    }

    removePvpTeamInvite(inviteId);
    emitToUser(io, invite.senderId, "pvp-team:invite:declined", { inviteId });

    console.log(
      `[Socket.io] PvP Team invite ${inviteId} recusado por ${userId}`
    );
  });

  // -------------------------------------------------------------------------
  // pvp-team:friends:online-check
  // -------------------------------------------------------------------------

  socket.on("pvp-team:friends:online-check", (payload: unknown) => {
    if (!isValidOnlineCheckPayload(payload)) {
      socket.emit("pvp-team:invite:error", {
        message: "Payload invalido para pvp-team:friends:online-check",
      });
      return;
    }

    const { userIds } = payload;
    const statuses: Record<string, boolean> = {};

    for (const id of userIds) {
      statuses[id] = isOnline(id);
    }

    socket.emit("pvp-team:friends:online-status", { statuses });
  });

  // -------------------------------------------------------------------------
  // disconnect — cleanup de convites pendentes
  // -------------------------------------------------------------------------

  socket.on("disconnect", () => {
    const INVITE_DISCONNECT_GRACE_MS = 10_000;

    setTimeout(() => {
      if (isOnline(userId)) return;

      // Se sender tem convites pendentes: notificar targets e remover
      const senderInvite = getInviteBySender(userId);
      if (senderInvite) {
        emitToUser(io, senderInvite.targetId, "pvp-team:invite:expired", {
          inviteId: senderInvite.inviteId,
        });
        removeInvitesBySender(userId);
      }

      // Se target tem convite pendente: cancelar
      const targetInvite = getInviteByTarget(userId);
      if (targetInvite) {
        emitToUser(io, targetInvite.senderId, "pvp-team:invite:expired", {
          inviteId: targetInvite.inviteId,
        });
        removeInvitesByTarget(userId);
      }
    }, INVITE_DISCONNECT_GRACE_MS);
  });
}
