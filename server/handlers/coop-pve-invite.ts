// server/handlers/coop-pve-invite.ts — Convites de amigos para batalha coop PvE

import crypto from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { BaseStats, EquippedSkill } from "../../lib/battle/types";
import type {
  CoopPveMode,
  CoopPveMobConfig,
  CoopPveBattleConfig,
  CoopPveBattleSession,
} from "../../lib/battle/coop-pve-types";
import type { AiProfile } from "../../lib/battle/ai-profiles";
import { convertToEquippedSkills, extractBaseStats, CHARACTER_SKILLS_SELECT } from "../lib/convert-skills";
import { initCoopPveBattle } from "../../lib/battle/coop-pve-turn";
import { isInQueue } from "../stores/queue-store";
import { getPlayerBattle } from "../stores/pvp-store";
import { isInBossQueue } from "../stores/boss-queue-store";
import { getPlayerBossBattle } from "../stores/boss-battle-store";
import { isInCoopPveQueue } from "../stores/coop-pve-queue-store";
import { getPlayerCoopPveBattle, setCoopPveBattle } from "../stores/coop-pve-battle-store";
import { isOnline, getSocketIds } from "../stores/user-store";
import {
  setInvite,
  getInvite,
  removeInvite,
  getInviteBySender,
  getInviteByTarget,
  removeInvitesBySender,
  removeInvitesByTarget,
} from "../stores/coop-pve-invite-store";
import { sanitizeCoopPveStateForTeam } from "./coop-pve-battle";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const INVITE_TTL_MS = 30_000;
const VALID_MODES: CoopPveMode[] = ["2v3", "2v5"];
const MAX_ONLINE_CHECK_IDS = 50;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isValidSendPayload(
  payload: unknown
): payload is { targetUserId: string; mode: CoopPveMode } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.targetUserId === "string" &&
    p.targetUserId.length > 0 &&
    typeof p.mode === "string" &&
    VALID_MODES.includes(p.mode as CoopPveMode)
  );
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
  return p.userIds.every((id: unknown) => typeof id === "string" && id.length > 0);
}

// ---------------------------------------------------------------------------
// Helper: verificar se player esta em fila/batalha
// ---------------------------------------------------------------------------

function isPlayerBusy(userId: string): boolean {
  return (
    isInQueue(userId) ||
    isInBossQueue(userId) ||
    isInCoopPveQueue(userId) ||
    getPlayerBattle(userId) !== undefined ||
    getPlayerBossBattle(userId) !== undefined ||
    getPlayerCoopPveBattle(userId) !== undefined
  );
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
// Handler principal
// ---------------------------------------------------------------------------

export function registerCoopPveInviteHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  // -------------------------------------------------------------------------
  // coop-pve:invite:send
  // -------------------------------------------------------------------------

  socket.on("coop-pve:invite:send", async (payload: unknown) => {
    if (!isValidSendPayload(payload)) {
      socket.emit("coop-pve:invite:error", {
        message: "Payload invalido para coop-pve:invite:send",
      });
      return;
    }

    const { targetUserId, mode } = payload;

    // Sender nao pode convidar a si mesmo
    if (targetUserId === userId) {
      socket.emit("coop-pve:invite:error", {
        message: "Voce nao pode convidar a si mesmo",
      });
      return;
    }

    // Sender nao pode estar em fila/batalha
    if (isPlayerBusy(userId)) {
      socket.emit("coop-pve:invite:error", {
        message: "Voce esta em uma fila ou batalha ativa",
      });
      return;
    }

    // Sender nao pode ter convite pendente
    if (getInviteBySender(userId)) {
      socket.emit("coop-pve:invite:error", {
        message: "Voce ja tem um convite pendente",
      });
      return;
    }

    // Target deve estar online
    if (!isOnline(targetUserId)) {
      socket.emit("coop-pve:invite:error", {
        message: "O jogador nao esta online",
      });
      return;
    }

    // Target nao pode estar em fila/batalha
    if (isPlayerBusy(targetUserId)) {
      socket.emit("coop-pve:invite:error", {
        message: "O jogador esta ocupado em uma fila ou batalha",
      });
      return;
    }

    // Target nao pode ter convite pendente (como target)
    if (getInviteByTarget(targetUserId)) {
      socket.emit("coop-pve:invite:error", {
        message: "O jogador ja tem um convite pendente",
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
      socket.emit("coop-pve:invite:error", {
        message: "Voce so pode convidar amigos para batalha",
      });
      return;
    }

    // Verificar que sender tem character com skills equipadas
    const character = await prisma.character.findUnique({
      where: { userId },
      select: {
        id: true,
        characterSkills: CHARACTER_SKILLS_SELECT,
      },
    });

    if (!character || character.characterSkills.length === 0) {
      socket.emit("coop-pve:invite:error", {
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
      socket.emit("coop-pve:invite:error", {
        message: "Erro ao buscar dados do usuario",
      });
      return;
    }

    // Criar convite
    const inviteId = crypto.randomUUID();
    const senderName = senderUser.name;

    const timer = setTimeout(() => {
      removeInvite(inviteId);
      emitToUser(io, userId, "coop-pve:invite:expired", { inviteId });
      emitToUser(io, targetUserId, "coop-pve:invite:expired", { inviteId });
      console.log(`[Socket.io] Coop PvE invite ${inviteId} expirou (${userId} -> ${targetUserId})`);
    }, INVITE_TTL_MS);

    setInvite({
      inviteId,
      senderId: userId,
      senderSocketId: socket.id,
      senderName,
      targetId: targetUserId,
      mode,
      createdAt: Date.now(),
      timer,
    });

    // Notificar target
    emitToUser(io, targetUserId, "coop-pve:invite:received", {
      inviteId,
      from: { userId, name: senderName },
      mode,
    });

    // Confirmar para sender
    socket.emit("coop-pve:invite:sent", {
      inviteId,
      targetUserId,
      mode,
    });

    console.log(
      `[Socket.io] Coop PvE invite ${inviteId}: ${userId} -> ${targetUserId} (${mode})`
    );
  });

  // -------------------------------------------------------------------------
  // coop-pve:invite:accept
  // -------------------------------------------------------------------------

  socket.on("coop-pve:invite:accept", async (payload: unknown) => {
    if (!isValidInviteIdPayload(payload)) {
      socket.emit("coop-pve:invite:error", {
        message: "Payload invalido para coop-pve:invite:accept",
      });
      return;
    }

    const { inviteId } = payload;
    const invite = getInvite(inviteId);

    if (!invite) {
      socket.emit("coop-pve:invite:error", {
        message: "Convite nao encontrado ou expirado",
      });
      return;
    }

    // Apenas o target pode aceitar
    if (invite.targetId !== userId) {
      socket.emit("coop-pve:invite:error", {
        message: "Voce nao e o destinatario deste convite",
      });
      return;
    }

    // Target nao pode ter entrado em fila/batalha enquanto esperava
    if (isPlayerBusy(userId)) {
      socket.emit("coop-pve:invite:error", {
        message: "Voce esta em uma fila ou batalha ativa",
      });
      removeInvite(inviteId);
      emitToUser(io, invite.senderId, "coop-pve:invite:expired", { inviteId });
      return;
    }

    // Sender tambem nao pode estar busy agora
    if (isPlayerBusy(invite.senderId)) {
      socket.emit("coop-pve:invite:error", {
        message: "O jogador que convidou esta ocupado agora",
      });
      removeInvite(inviteId);
      return;
    }

    // Remover convite do store
    removeInvite(inviteId);

    const { senderId, mode } = invite;
    const mobCount = mode === "2v3" ? 3 : 5;

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
      socket.emit("coop-pve:invite:error", {
        message: "Um dos jogadores nao tem personagem",
      });
      emitToUser(io, senderId, "coop-pve:invite:error", {
        message: "Nao foi possivel iniciar a batalha: personagem nao encontrado",
      });
      return;
    }

    // Validar que ambos tem skills equipadas
    for (const char of characters) {
      if (char.characterSkills.length === 0) {
        socket.emit("coop-pve:invite:error", {
          message: "Um dos jogadores nao tem skills equipadas",
        });
        emitToUser(io, senderId, "coop-pve:invite:error", {
          message: "Nao foi possivel iniciar a batalha: jogador sem skills",
        });
        return;
      }
    }

    // Calcular tier
    const avgLevel = Math.round(
      characters.reduce((sum, c) => sum + c.level, 0) / characters.length
    );
    const playerTier = Math.max(1, Math.min(5, Math.ceil(avgLevel / 10)));

    // Buscar mobs do tier
    let allMobs = await prisma.mob.findMany({
      where: { tier: playerTier },
      include: {
        skills: {
          orderBy: { slotIndex: "asc" },
          include: {
            skill: {
              select: {
                id: true,
                name: true,
                description: true,
                tier: true,
                cooldown: true,
                target: true,
                damageType: true,
                basePower: true,
                hits: true,
                accuracy: true,
                effects: true,
                mastery: true,
              },
            },
          },
        },
      },
    });

    // Fallback tier adjacente
    if (allMobs.length === 0) {
      const fallbackTier = playerTier > 1 ? playerTier - 1 : playerTier + 1;
      allMobs = await prisma.mob.findMany({
        where: { tier: fallbackTier },
        include: {
          skills: {
            orderBy: { slotIndex: "asc" },
            include: {
              skill: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  tier: true,
                  cooldown: true,
                  target: true,
                  damageType: true,
                  basePower: true,
                  hits: true,
                  accuracy: true,
                  effects: true,
                  mastery: true,
                },
              },
            },
          },
        },
      });
    }

    if (allMobs.length === 0) {
      socket.emit("coop-pve:invite:error", {
        message: "Nenhum mob disponivel para batalha no momento",
      });
      emitToUser(io, senderId, "coop-pve:invite:error", {
        message: "Nenhum mob disponivel para batalha no momento",
      });
      return;
    }

    // Shuffle Fisher-Yates
    const shuffled = [...allMobs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selectedMobs = shuffled.slice(0, Math.min(mobCount, shuffled.length));
    while (selectedMobs.length < mobCount) {
      selectedMobs.push(allMobs[Math.floor(Math.random() * allMobs.length)]);
    }

    // Converter mobs para CoopPveMobConfig[]
    const mobConfigs: CoopPveMobConfig[] = selectedMobs.map((mob) => ({
      mobId: mob.id,
      name: mob.name,
      tier: mob.tier,
      aiProfile: mob.aiProfile as AiProfile,
      stats: extractBaseStats(mob),
      skills: convertToEquippedSkills(mob.skills),
      imageUrl: mob.imageUrl ?? null,
    }));

    // Criar battle config
    const battleId = crypto.randomUUID();
    const team = characters.map((char) => ({
      userId: char.userId,
      characterId: char.id,
      stats: extractBaseStats(char) as BaseStats,
      skills: convertToEquippedSkills(char.characterSkills) as EquippedSkill[],
    }));

    const battleConfig: CoopPveBattleConfig = {
      battleId,
      team,
      mobs: mobConfigs,
      mode,
    };

    const state = initCoopPveBattle(battleConfig);

    // Buscar user info (names, avatars, houses)
    const users = await prisma.user.findMany({
      where: { id: { in: [senderId, userId] } },
      select: { id: true, name: true, avatarUrl: true, house: { select: { name: true } } },
    });

    // Determinar sockets atuais dos 2 players
    const senderSocketIds = getSocketIds(senderId);
    const targetSocketIds = getSocketIds(userId);
    const senderSocketId = senderSocketIds ? Array.from(senderSocketIds)[0] : invite.senderSocketId;
    const targetSocketId = targetSocketIds ? Array.from(targetSocketIds)[0] : socket.id;

    // Criar session
    const session: CoopPveBattleSession = {
      battleId,
      state,
      mobConfigs,
      playerSockets: new Map([
        [senderId, senderSocketId],
        [userId, targetSocketId],
      ]),
      playerNames: new Map(users.map((u) => [u.id, u.name])),
      playerAvatars: new Map(users.map((u) => [u.id, u.avatarUrl])),
      playerHouses: new Map(users.map((u) => [u.id, u.house?.name ?? ""])),
      pendingActions: new Map(),
      turnTimer: null,
      matchAccepted: new Set([senderId, userId]),
      matchTimer: null,
      disconnectedPlayers: new Map(),
      lastActivityAt: Date.now(),
    };

    setCoopPveBattle(battleId, session);

    // Persistir PveBattle records (fire-and-forget)
    const mobIds = mobConfigs.map((m) => m.mobId);
    for (const pUserId of [senderId, userId]) {
      const teammateId = pUserId === senderId ? userId : senderId;
      prisma.pveBattle
        .create({
          data: {
            userId: pUserId,
            mobId: mobConfigs[0].mobId,
            mode: mode === "2v3" ? "COOP_2V3" : "COOP_2V5",
            teamMateId: teammateId,
            mobIds,
          },
        })
        .catch((err) => {
          console.log(
            `[Socket.io] Erro ao criar PveBattle para ${pUserId} na coop PvE invite ${battleId}: ${String(err)}`
          );
        });
    }

    // Join ALL sockets de ambos os players na room
    // (cada player pode ter multiplos sockets: layout + hook)
    const roomName = `coop-pve-battle:${battleId}`;
    const allSenderSockets = getSocketIds(senderId);
    const allTargetSockets = getSocketIds(userId);

    if (allSenderSockets) {
      for (const sid of allSenderSockets) {
        io.sockets.sockets.get(sid)?.join(roomName);
      }
    }
    if (allTargetSockets) {
      for (const sid of allTargetSockets) {
        io.sockets.sockets.get(sid)?.join(roomName);
      }
    }

    // Sanitizar estado e emitir battle:start para TODOS os sockets na room
    const sanitized = sanitizeCoopPveStateForTeam(
      state,
      Object.fromEntries(session.playerNames),
      Object.fromEntries(session.playerAvatars),
      Object.fromEntries(session.playerHouses),
      mobConfigs,
    );

    io.to(roomName).emit("coop-pve:battle:start", {
      battleId,
      state: sanitized,
    });

    console.log(
      `[Socket.io] Coop PvE battle ${battleId} iniciada via invite (${senderId} + ${userId}, ${mode})`
    );
  });

  // -------------------------------------------------------------------------
  // coop-pve:invite:decline
  // -------------------------------------------------------------------------

  socket.on("coop-pve:invite:decline", (payload: unknown) => {
    if (!isValidInviteIdPayload(payload)) {
      socket.emit("coop-pve:invite:error", {
        message: "Payload invalido para coop-pve:invite:decline",
      });
      return;
    }

    const { inviteId } = payload;
    const invite = getInvite(inviteId);

    if (!invite) {
      socket.emit("coop-pve:invite:error", {
        message: "Convite nao encontrado ou expirado",
      });
      return;
    }

    if (invite.targetId !== userId) {
      socket.emit("coop-pve:invite:error", {
        message: "Voce nao e o destinatario deste convite",
      });
      return;
    }

    removeInvite(inviteId);

    // Notificar sender
    emitToUser(io, invite.senderId, "coop-pve:invite:declined", { inviteId });

    console.log(
      `[Socket.io] Coop PvE invite ${inviteId} recusado por ${userId}`
    );
  });

  // -------------------------------------------------------------------------
  // coop-pve:friends:online-check
  // -------------------------------------------------------------------------

  socket.on("coop-pve:friends:online-check", (payload: unknown) => {
    if (!isValidOnlineCheckPayload(payload)) {
      socket.emit("coop-pve:invite:error", {
        message: "Payload invalido para coop-pve:friends:online-check",
      });
      return;
    }

    const { userIds } = payload;
    const statuses: Record<string, boolean> = {};

    for (const id of userIds) {
      statuses[id] = isOnline(id);
    }

    socket.emit("coop-pve:friends:online-status", { statuses });
  });

  // -------------------------------------------------------------------------
  // disconnect — cleanup de convites pendentes
  // -------------------------------------------------------------------------

  socket.on("disconnect", () => {
    // Se sender tem convite pendente: notificar target
    const senderInvite = getInviteBySender(userId);
    if (senderInvite) {
      emitToUser(io, senderInvite.targetId, "coop-pve:invite:expired", {
        inviteId: senderInvite.inviteId,
      });
    }
    removeInvitesBySender(userId);

    // Se target tem convite pendente: notificar sender
    const targetInvite = getInviteByTarget(userId);
    if (targetInvite) {
      emitToUser(io, targetInvite.senderId, "coop-pve:invite:expired", {
        inviteId: targetInvite.inviteId,
      });
    }
    removeInvitesByTarget(userId);
  });
}
