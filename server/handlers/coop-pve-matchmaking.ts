// server/handlers/coop-pve-matchmaking.ts — Fila e emparelhamento para Coop PvE (2v3/2v5/3v5)

import crypto from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { BaseStats, EquippedSkill } from "../../lib/battle/types";
import type { CoopPveMode, CoopPveMobConfig, CoopPveBattleConfig, CoopPveBattleSession } from "../../lib/battle/coop-pve-types";
import type { AiProfile } from "../../lib/battle/ai-profiles";
import { convertToEquippedSkills, extractBaseStats, CHARACTER_SKILLS_SELECT } from "../lib/convert-skills";
import { loadEquippedCardsAndApply } from "../../lib/cards/load-equipped";
import { initCoopPveBattle } from "../../lib/battle/coop-pve-turn";
import { isInQueue } from "../stores/queue-store";
import { getPlayerBattle } from "../stores/pvp-store";
import { isInBossQueue } from "../stores/boss-queue-store";
import { getPlayerBossBattle } from "../stores/boss-battle-store";
import {
  addToCoopPveQueue,
  removeFromCoopPveQueue,
  isInCoopPveQueue,
  findCoopPveMatch,
  getCoopPveQueuePosition,
  getCoopPveQueueSize,
} from "../stores/coop-pve-queue-store";
import {
  setCoopPveBattle,
  getCoopPveBattle,
  removeCoopPveBattle,
  getPlayerCoopPveBattle,
} from "../stores/coop-pve-battle-store";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MATCH_ACCEPT_TIMEOUT_MS = 30_000;
const QUEUE_TIMEOUT_MS = 5 * 60_000;

const VALID_MODES: CoopPveMode[] = ["2v3", "2v5", "3v5"];

// Timers de queue timeout por userId (compartilhado entre handlers e disconnect)
const queueTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isValidMode(value: unknown): value is CoopPveMode {
  return typeof value === "string" && VALID_MODES.includes(value as CoopPveMode);
}

function isValidJoinPayload(payload: unknown): payload is { mode: CoopPveMode } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return isValidMode(p.mode);
}

function isValidBattleIdPayload(payload: unknown): payload is { battleId: string } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.battleId === "string" && p.battleId.length > 0;
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export function registerCoopPveMatchmakingHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  // -------------------------------------------------------------------------
  // coop-pve:queue:join
  // -------------------------------------------------------------------------

  socket.on("coop-pve:queue:join", async (payload: unknown) => {
    if (!isValidJoinPayload(payload)) {
      socket.emit("coop-pve:queue:error", {
        message: "Payload invalido para coop-pve:queue:join",
      });
      return;
    }

    const { mode } = payload;

    // Verificar que nao esta em nenhuma outra fila/batalha ativa
    if (isInQueue(userId)) {
      socket.emit("coop-pve:queue:error", {
        message: "Voce ja esta na fila de PvP",
      });
      return;
    }

    if (isInBossQueue(userId)) {
      socket.emit("coop-pve:queue:error", {
        message: "Voce ja esta na fila de boss fight",
      });
      return;
    }

    if (isInCoopPveQueue(userId)) {
      socket.emit("coop-pve:queue:error", {
        message: "Voce ja esta na fila de batalha coop PvE",
      });
      return;
    }

    if (getPlayerBattle(userId)) {
      socket.emit("coop-pve:queue:error", {
        message: "Voce ja esta em uma batalha PvP ativa",
      });
      return;
    }

    if (getPlayerBossBattle(userId)) {
      socket.emit("coop-pve:queue:error", {
        message: "Voce ja esta em uma boss fight ativa",
      });
      return;
    }

    if (getPlayerCoopPveBattle(userId)) {
      socket.emit("coop-pve:queue:error", {
        message: "Voce ja esta em uma batalha coop PvE ativa",
      });
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
      socket.emit("coop-pve:queue:error", {
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

    // Adicionar na fila
    const added = addToCoopPveQueue({
      userId,
      socketId: socket.id,
      characterId: character.id,
      stats,
      skills,
      spectralSkill,
      mode,
      joinedAt: Date.now(),
    });

    if (!added) {
      socket.emit("coop-pve:queue:error", {
        message: "Nao foi possivel entrar na fila",
      });
      return;
    }

    const position = getCoopPveQueuePosition(userId);
    const size = getCoopPveQueueSize(mode);

    socket.emit("coop-pve:queue:status", {
      position,
      size,
      mode,
    });

    console.log(
      `[Socket.io] ${userId} entrou na fila coop PvE (${mode}). Posicao: ${position}/${size}`
    );

    // Setar queue timeout (5 min)
    const queueTimer = setTimeout(() => {
      removeFromCoopPveQueue(userId);
      queueTimeouts.delete(userId);
      socket.emit("coop-pve:queue:timeout", {
        message: "Tempo na fila expirou. Tente novamente.",
      });
      console.log(`[Socket.io] ${userId} removido da fila coop PvE por timeout`);
    }, QUEUE_TIMEOUT_MS);

    queueTimeouts.set(userId, queueTimer);

    // Tentar match
    const matched = findCoopPveMatch(mode);
    if (!matched) return;

    // Limpar queueTimeouts dos 2 jogadores
    for (const entry of matched) {
      const timer = queueTimeouts.get(entry.userId);
      if (timer) {
        clearTimeout(timer);
        queueTimeouts.delete(entry.userId);
      }
    }

    // Matchmaking: calcular tier baseado na media dos levels dos players
    const mobCount = mode === "2v3" ? 3 : 5;
    const playerChars = await prisma.character.findMany({
      where: { userId: { in: matched.map((e) => e.userId) } },
      select: { level: true },
    });
    const avgLevel = playerChars.length > 0
      ? Math.round(playerChars.reduce((sum, c) => sum + c.level, 0) / playerChars.length)
      : 1;
    const playerTier = Math.max(1, Math.min(5, Math.ceil(avgLevel / 10)));

    // Buscar mobs do tier adequado (fallback para tier adjacente se vazio)
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

    // Fallback: tier adjacente se nenhum mob encontrado
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
      // Devolver jogadores para a fila
      for (const entry of matched) {
        addToCoopPveQueue(entry);
      }
      console.log(`[Socket.io] Nenhum mob encontrado no banco para coop PvE (tier ${playerTier})`);
      return;
    }

    // Shuffle Fisher-Yates
    const shuffled = [...allMobs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selectedMobs = shuffled.slice(0, Math.min(mobCount, shuffled.length));
    // Se menos mobs que mobCount: permitir repeticao
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

    // Escalar stats dos mobs para 3v5 (3 players = mobs mais fortes)
    if (mode === "3v5") {
      for (const mob of mobConfigs) {
        mob.stats = {
          ...mob.stats,
          hp: Math.floor(mob.stats.hp * 1.4),
          physicalAtk: Math.floor(mob.stats.physicalAtk * 1.25),
          magicAtk: Math.floor(mob.stats.magicAtk * 1.25),
        };
      }
    }

    // Criar estado via engine
    const battleId = crypto.randomUUID();
    const battleConfig: CoopPveBattleConfig = {
      battleId,
      team: matched.map((entry) => ({
        userId: entry.userId,
        characterId: entry.characterId,
        stats: entry.stats,
        skills: entry.skills,
        spectralSkill: entry.spectralSkill,
      })),
      mobs: mobConfigs,
      mode,
    };

    const state = initCoopPveBattle(battleConfig);

    // Buscar nomes/avatars/houses dos players
    const users = await prisma.user.findMany({
      where: { id: { in: matched.map((e) => e.userId) } },
      select: { id: true, name: true, avatarUrl: true, house: { select: { name: true } } },
    });

    // Criar session
    const session: CoopPveBattleSession = {
      battleId,
      state,
      mobConfigs,
      playerSockets: new Map(matched.map((e) => [e.userId, e.socketId])),
      playerNames: new Map(users.map((u) => [u.id, u.name])),
      playerAvatars: new Map(users.map((u) => [u.id, u.avatarUrl])),
      playerHouses: new Map(users.map((u) => [u.id, u.house?.name ?? ""])),
      pendingActions: new Map(),
      turnTimer: null,
      matchAccepted: new Set(),
      matchTimer: null,
      disconnectedPlayers: new Map(),
      lastActivityAt: Date.now(),
    };

    setCoopPveBattle(battleId, session);

    // Emitir coop-pve:match:found para todos os sockets
    for (const entry of matched) {
      const playerSocket = io.sockets.sockets.get(entry.socketId);
      if (playerSocket) {
        const teammates = users
          .filter((u) => u.id !== entry.userId)
          .map((u) => ({ userId: u.id, name: u.name }));

        playerSocket.emit("coop-pve:match:found", {
          battleId,
          teammates, // array (1 item para 2v3/2v5, 2 items para 3v5)
          teammate: teammates[0] ?? null, // compatibilidade com frontend existente
          mobs: mobConfigs.map((m) => ({ name: m.name, tier: m.tier })),
          mode,
          acceptTimeoutMs: MATCH_ACCEPT_TIMEOUT_MS,
        });
      }
    }

    console.log(
      `[Socket.io] Coop PvE match encontrado: ${matched.map((m) => m.userId).join(", ")} (${mode}) -> batalha ${battleId}`
    );

    // Setar match accept timer (30s)
    const matchTimer = setTimeout(() => {
      const currentSession = getCoopPveBattle(battleId);
      if (!currentSession) return;

      // Quem nao aceitou recebe timeout
      for (const [pUserId, pSocketId] of currentSession.playerSockets) {
        const pSocket = io.sockets.sockets.get(pSocketId);
        if (!currentSession.matchAccepted.has(pUserId)) {
          pSocket?.emit("coop-pve:match:timeout", {
            message: "Tempo para aceitar expirou",
          });
        }
      }

      // Devolver quem aceitou para a fila
      for (const acceptedUserId of currentSession.matchAccepted) {
        const originalEntry = matched.find((m) => m.userId === acceptedUserId);
        if (originalEntry) {
          originalEntry.socketId =
            currentSession.playerSockets.get(acceptedUserId) ?? originalEntry.socketId;
          addToCoopPveQueue(originalEntry);
          const acceptedSocket = io.sockets.sockets.get(
            currentSession.playerSockets.get(acceptedUserId) ?? ""
          );
          acceptedSocket?.emit("coop-pve:match:cancelled", {
            message: "Um jogador nao aceitou a tempo. Voce foi devolvido a fila.",
          });
        }
      }

      removeCoopPveBattle(battleId);
      console.log(
        `[Socket.io] Coop PvE match ${battleId} cancelado por timeout de aceite`
      );
    }, MATCH_ACCEPT_TIMEOUT_MS);

    session.matchTimer = matchTimer;
  });

  // -------------------------------------------------------------------------
  // coop-pve:queue:leave
  // -------------------------------------------------------------------------

  socket.on("coop-pve:queue:leave", () => {
    const timer = queueTimeouts.get(userId);
    if (timer) {
      clearTimeout(timer);
      queueTimeouts.delete(userId);
    }

    removeFromCoopPveQueue(userId);
    socket.emit("coop-pve:queue:left", {
      message: "Saiu da fila de batalha coop PvE",
    });
    console.log(`[Socket.io] ${userId} saiu da fila coop PvE`);
  });

  // -------------------------------------------------------------------------
  // coop-pve:match:accept
  // -------------------------------------------------------------------------

  socket.on("coop-pve:match:accept", (payload: unknown) => {
    if (!isValidBattleIdPayload(payload)) {
      socket.emit("coop-pve:queue:error", {
        message: "Payload invalido para coop-pve:match:accept",
      });
      return;
    }

    const { battleId } = payload;
    const session = getCoopPveBattle(battleId);

    if (!session) {
      socket.emit("coop-pve:queue:error", {
        message: "Sessao de coop PvE nao encontrada",
      });
      return;
    }

    if (!session.playerSockets.has(userId)) {
      socket.emit("coop-pve:queue:error", {
        message: "Voce nao pertence a esta sessao",
      });
      return;
    }

    if (session.matchAccepted.has(userId)) {
      socket.emit("coop-pve:queue:error", {
        message: "Voce ja aceitou esta batalha coop PvE",
      });
      return;
    }

    session.matchAccepted.add(userId);
    session.lastActivityAt = Date.now();

    const requiredAccepts = session.state.mode === "3v5" ? 3 : 2;
    if (session.matchAccepted.size >= requiredAccepts) {
      // Todos aceitaram
      if (session.matchTimer) {
        clearTimeout(session.matchTimer);
        session.matchTimer = null;
      }

      // Joinar sockets na room
      const roomName = `coop-pve-battle:${battleId}`;
      for (const [, pSocketId] of session.playerSockets) {
        const pSocket = io.sockets.sockets.get(pSocketId);
        pSocket?.join(roomName);
      }

      // Registrar PveBattle no banco ao INICIAR (result null)
      const mobIds = session.mobConfigs.map((m) => m.mobId);
      const modeEnumMap: Record<CoopPveMode, "COOP_2V3" | "COOP_2V5" | "COOP_3V5"> = {
        "2v3": "COOP_2V3",
        "2v5": "COOP_2V5",
        "3v5": "COOP_3V5",
      };
      const modeEnum = modeEnumMap[session.state.mode];
      const allPlayerIds = Array.from(session.playerSockets.keys());

      for (const pUserId of allPlayerIds) {
        // Primeiro teammate como teamMateId (compatibilidade)
        const teammateId = allPlayerIds.find((id) => id !== pUserId) ?? null;
        prisma.pveBattle
          .create({
            data: {
              userId: pUserId,
              mobId: session.mobConfigs[0].mobId,
              mode: modeEnum,
              teamMateId: teammateId,
              mobIds,
            },
          })
          .catch((err) => {
            console.log(
              `[Socket.io] Erro ao criar PveBattle para ${pUserId} na coop PvE ${battleId}: ${String(err)}`
            );
          });
      }

      // Emitir coop-pve:battle:start
      io.to(roomName).emit("coop-pve:battle:start", {
        battleId,
      });

      console.log(`[Socket.io] Coop PvE battle ${battleId} iniciada (aguardando players carregarem)`);
    } else {
      // Notificar contagem
      io.to(Array.from(session.playerSockets.values())).emit(
        "coop-pve:match:accepted",
        {
          accepted: session.matchAccepted.size,
          total: requiredAccepts,
        }
      );
    }
  });

  // -------------------------------------------------------------------------
  // coop-pve:match:decline
  // -------------------------------------------------------------------------

  socket.on("coop-pve:match:decline", (payload: unknown) => {
    if (!isValidBattleIdPayload(payload)) {
      socket.emit("coop-pve:queue:error", {
        message: "Payload invalido para coop-pve:match:decline",
      });
      return;
    }

    const { battleId } = payload;
    const session = getCoopPveBattle(battleId);

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
      pSocket?.emit("coop-pve:match:cancelled", {
        message: "Um jogador recusou a batalha coop PvE.",
      });

      // Devolver quem aceitou para a fila
      if (session.matchAccepted.has(pUserId)) {
        const playerState = session.state.team.find(
          (p) => p.playerId === pUserId
        );
        if (playerState) {
          addToCoopPveQueue({
            userId: pUserId,
            socketId: pSocketId,
            characterId: playerState.characterId,
            stats: playerState.baseStats,
            skills: playerState.equippedSkills,
            mode: session.state.mode,
            joinedAt: Date.now(),
          });
        }
      }
    }

    removeCoopPveBattle(battleId);
    console.log(
      `[Socket.io] Coop PvE match ${battleId} cancelado: ${userId} recusou`
    );
  });

  // disconnect cleanup centralizado em handleCoopPveMatchmakingDisconnect
}

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

export function handleCoopPveMatchmakingDisconnect(
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
  removeFromCoopPveQueue(userId);

  // Se em match pendente: tratar como decline
  const result = getPlayerCoopPveBattle(userId);
  if (result && result.session.matchTimer) {
    const { battleId, session } = result;

    if (session.matchTimer) {
      clearTimeout(session.matchTimer);
      session.matchTimer = null;
    }

    for (const [pUserId, pSocketId] of session.playerSockets) {
      if (pUserId === userId) continue;
      const pSocket = io.sockets.sockets.get(pSocketId);
      pSocket?.emit("coop-pve:match:cancelled", {
        message: "Um jogador desconectou durante a selecao.",
      });

      if (session.matchAccepted.has(pUserId)) {
        const playerState = session.state.team.find(
          (p) => p.playerId === pUserId
        );
        if (playerState) {
          addToCoopPveQueue({
            userId: pUserId,
            socketId: pSocketId,
            characterId: playerState.characterId,
            stats: playerState.baseStats,
            skills: playerState.equippedSkills,
            mode: session.state.mode,
            joinedAt: Date.now(),
          });
        }
      }
    }

    removeCoopPveBattle(battleId);
    console.log(
      `[Socket.io] Coop PvE match ${battleId} cancelado: ${userId} desconectou durante aceite`
    );
  }
  // Batalha ativa: delegado para coop-pve-battle handler via disconnect
}
