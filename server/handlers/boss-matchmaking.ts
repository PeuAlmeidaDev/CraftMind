// server/handlers/boss-matchmaking.ts — Fila e emparelhamento para Boss Fight 3v1

import crypto from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { HabitCategory } from "@prisma/client";
import type { BaseStats, EquippedSkill } from "../../lib/battle/types";
import type { CoopBattlePlayerConfig } from "../../lib/battle/coop-types";
import { convertToEquippedSkills, extractBaseStats } from "../lib/convert-skills";
import { initCoopBattle } from "../../lib/battle/coop-turn";
import { isInQueue } from "../stores/queue-store";
import { getPlayerBattle } from "../stores/pvp-store";
import { isInCoopPveQueue } from "../stores/coop-pve-queue-store";
import { getPlayerCoopPveBattle } from "../stores/coop-pve-battle-store";
import {
  addToBossQueue,
  removeFromBossQueue,
  isInBossQueue,
  findBossMatch,
  getQueuePosition,
  getQueueSize,
} from "../stores/boss-queue-store";
import type { BossQueueEntry } from "../stores/boss-queue-store";
import {
  setBossBattle,
  getBossBattle,
  removeBossBattle,
  getPlayerBossBattle,
} from "../stores/boss-battle-store";
import type { BossBattleSession } from "../stores/boss-battle-store";
import { prisma } from "../lib/prisma";
import { getDominantCategory } from "../../lib/helpers/dominant-category";
import { getTodayDateBRT } from "../../lib/helpers/date-utils";
import { DAILY_TASK_LIMIT } from "../../lib/tasks/generate-daily";
import { startBossTurnTimer } from "./boss-battle";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MATCH_ACCEPT_TIMEOUT_MS = 30_000;
const QUEUE_TIMEOUT_MS = 5 * 60_000;

const VALID_CATEGORIES: HabitCategory[] = [
  "PHYSICAL",
  "INTELLECTUAL",
  "MENTAL",
  "SOCIAL",
  "SPIRITUAL",
];

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isValidCategory(value: unknown): value is HabitCategory {
  return typeof value === "string" && VALID_CATEGORIES.includes(value as HabitCategory);
}

function isValidJoinPayload(payload: unknown): payload is { category: HabitCategory } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return isValidCategory(p.category);
}

function isValidBattleIdPayload(payload: unknown): payload is { battleId: string } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.battleId === "string" && p.battleId.length > 0;
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export function registerBossMatchmakingHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;
  const queueTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  // -------------------------------------------------------------------------
  // boss:queue:join
  // -------------------------------------------------------------------------

  socket.on("boss:queue:join", async (payload: unknown) => {
    if (!isValidJoinPayload(payload)) {
      socket.emit("boss:queue:error", {
        message: "Payload invalido para boss:queue:join",
      });
      return;
    }

    const { category } = payload;

    // Verificar que nao esta em nenhuma fila ou batalha ativa
    if (isInQueue(userId)) {
      socket.emit("boss:queue:error", {
        message: "Voce ja esta na fila de PvP",
      });
      return;
    }

    if (isInBossQueue(userId)) {
      socket.emit("boss:queue:error", {
        message: "Voce ja esta na fila de boss fight",
      });
      return;
    }

    if (getPlayerBattle(userId)) {
      socket.emit("boss:queue:error", {
        message: "Voce ja esta em uma batalha PvP ativa",
      });
      return;
    }

    if (getPlayerBossBattle(userId)) {
      socket.emit("boss:queue:error", {
        message: "Voce ja esta em uma boss fight ativa",
      });
      return;
    }

    if (isInCoopPveQueue(userId)) {
      socket.emit("boss:queue:error", {
        message: "Voce ja esta na fila de batalha coop PvE",
      });
      return;
    }

    const activeCoopPve = getPlayerCoopPveBattle(userId);
    if (activeCoopPve) {
      socket.emit("boss:queue:error", {
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
        characterSkills: {
          where: { equipped: true },
          orderBy: { slotIndex: "asc" },
          select: {
            slotIndex: true,
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

    if (!character || character.characterSkills.length === 0) {
      socket.emit("boss:queue:error", {
        message: "Personagem nao encontrado ou sem skills equipadas",
      });
      return;
    }

    // Verificar elegibilidade: TODAS as 5 tarefas diarias completas
    const today = getTodayDateBRT();
    const todayTasks = await prisma.dailyTask.findMany({
      where: {
        userId,
        dueDate: today,
      },
      select: {
        completed: true,
        habit: { select: { category: true } },
      },
    });

    const completedTasks = todayTasks.filter((t) => t.completed);

    if (completedTasks.length < DAILY_TASK_LIMIT) {
      socket.emit("boss:queue:error", {
        message: `Complete todas as ${DAILY_TASK_LIMIT} tarefas diarias primeiro (${completedTasks.length}/${DAILY_TASK_LIMIT})`,
      });
      return;
    }

    // Calcular dominantCategory a partir das tarefas completas
    const categories = completedTasks.map((t) => t.habit.category);
    const dominantCategory = getDominantCategory(categories);

    if (dominantCategory !== category) {
      socket.emit("boss:queue:error", {
        message: `Sua categoria dominante e ${dominantCategory}, nao ${category}`,
      });
      return;
    }

    // Verificar se ja participou de boss fight hoje
    const existingParticipation = await prisma.coopBattleParticipant.findFirst({
      where: {
        userId,
        coopBattle: {
          date: today,
        },
      },
    });

    if (existingParticipation) {
      socket.emit("boss:queue:error", {
        message: "Voce ja participou de uma boss fight hoje",
      });
      return;
    }

    const verifiedStats: BaseStats = extractBaseStats(character);
    const verifiedSkills: EquippedSkill[] = convertToEquippedSkills(character.characterSkills);

    // Adicionar na fila
    const added = addToBossQueue({
      userId,
      socketId: socket.id,
      characterId: character.id,
      stats: verifiedStats,
      skills: verifiedSkills,
      dominantCategory: category,
      joinedAt: Date.now(),
    });

    if (!added) {
      socket.emit("boss:queue:error", {
        message: "Nao foi possivel entrar na fila",
      });
      return;
    }

    const position = getQueuePosition(userId);
    const size = getQueueSize(category);

    socket.emit("boss:queue:status", {
      position,
      size,
      category,
    });

    console.log(
      `[Socket.io] ${userId} entrou na fila de boss fight (${category}). Posicao: ${position}/${size}`
    );

    // Setar queue timeout
    const queueTimer = setTimeout(() => {
      removeFromBossQueue(userId);
      queueTimeouts.delete(userId);
      socket.emit("boss:queue:timeout", {
        message: "Tempo na fila expirou. Tente novamente.",
      });
      console.log(`[Socket.io] ${userId} removido da fila de boss fight por timeout`);
    }, QUEUE_TIMEOUT_MS);

    queueTimeouts.set(userId, queueTimer);

    // Tentar match
    const matched = findBossMatch(category);
    if (!matched) return;

    // Limpar queueTimeouts dos 3 jogadores
    for (const entry of matched) {
      const timer = queueTimeouts.get(entry.userId);
      if (timer) {
        clearTimeout(timer);
        queueTimeouts.delete(entry.userId);
      }
    }

    // Sortear boss do pool da categoria
    const bosses = await prisma.boss.findMany({
      where: { category },
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

    if (bosses.length === 0) {
      // Devolver jogadores para a fila
      for (const entry of matched) {
        addToBossQueue(entry);
      }
      console.log(`[Socket.io] Nenhum boss encontrado para categoria ${category}`);
      return;
    }

    const selectedBoss = bosses[Math.floor(Math.random() * bosses.length)];

    const bossStats: BaseStats = extractBaseStats(selectedBoss);
    const bossSkills: EquippedSkill[] = convertToEquippedSkills(selectedBoss.skills);

    const battleId = crypto.randomUUID();

    const teamConfigs: CoopBattlePlayerConfig[] = matched.map((entry) => ({
      userId: entry.userId,
      characterId: entry.characterId,
      stats: entry.stats,
      skills: entry.skills,
    }));

    const bossConfig: CoopBattlePlayerConfig = {
      userId: selectedBoss.id,
      characterId: selectedBoss.id,
      stats: bossStats,
      skills: bossSkills,
    };

    const state = initCoopBattle({
      battleId,
      team: teamConfigs,
      boss: bossConfig,
    });

    const playerSockets = new Map<string, string>();
    const playerCategories = new Map<string, HabitCategory>();
    const playerNames = new Map<string, string>();
    for (const entry of matched) {
      playerSockets.set(entry.userId, entry.socketId);
      playerCategories.set(entry.userId, entry.dominantCategory);
    }

    // Buscar nomes dos players no banco
    const users = await prisma.user.findMany({
      where: { id: { in: matched.map((m) => m.userId) } },
      select: { id: true, name: true, avatarUrl: true, house: { select: { name: true } } },
    });
    for (const u of users) {
      playerNames.set(u.id, u.name);
    }

    const playerAvatars = new Map<string, string | null>();
    const playerHouses = new Map<string, string>();
    for (const u of users) {
      playerAvatars.set(u.id, u.avatarUrl);
      playerHouses.set(u.id, u.house?.name ?? "NOCTIS");
    }

    const session: BossBattleSession = {
      battleId,
      bossId: selectedBoss.id,
      bossName: selectedBoss.name,
      bossTier: selectedBoss.tier,
      bossAiProfile: selectedBoss.aiProfile,
      state,
      playerSockets,
      playerCategories,
      playerNames,
      playerAvatars,
      playerHouses,
      pendingActions: new Map(),
      turnTimer: null,
      matchAccepted: new Set(),
      matchTimer: null,
      disconnectedPlayers: new Map(),
      lastActivityAt: Date.now(),
    };

    setBossBattle(battleId, session);

    // Emitir boss:match:found para os 3 sockets
    const teammates = matched.map((entry) => ({
      userId: entry.userId,
      characterId: entry.characterId,
    }));

    for (const entry of matched) {
      const playerSocket = io.sockets.sockets.get(entry.socketId);
      if (playerSocket) {
        playerSocket.emit("boss:match:found", {
          battleId,
          boss: {
            id: selectedBoss.id,
            name: selectedBoss.name,
            tier: selectedBoss.tier,
            category,
          },
          teammates: teammates.filter((t) => t.userId !== entry.userId),
          acceptTimeoutMs: MATCH_ACCEPT_TIMEOUT_MS,
        });
      }
    }

    console.log(
      `[Socket.io] Boss match encontrado: ${matched.map((m) => m.userId).join(", ")} vs ${selectedBoss.name} -> batalha ${battleId}`
    );

    // Setar match accept timer
    const matchTimer = setTimeout(() => {
      const currentSession = getBossBattle(battleId);
      if (!currentSession) return;

      // Quem nao aceitou recebe timeout
      for (const [pUserId, pSocketId] of currentSession.playerSockets) {
        const pSocket = io.sockets.sockets.get(pSocketId);
        if (!currentSession.matchAccepted.has(pUserId)) {
          pSocket?.emit("boss:match:timeout", {
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
          addToBossQueue(originalEntry);
          const acceptedSocket = io.sockets.sockets.get(
            currentSession.playerSockets.get(acceptedUserId) ?? ""
          );
          acceptedSocket?.emit("boss:match:cancelled", {
            message: "Um jogador nao aceitou a tempo. Voce foi devolvido a fila.",
          });
        }
      }

      removeBossBattle(battleId);
      console.log(
        `[Socket.io] Boss match ${battleId} cancelado por timeout de aceite`
      );
    }, MATCH_ACCEPT_TIMEOUT_MS);

    session.matchTimer = matchTimer;
  });

  // -------------------------------------------------------------------------
  // boss:queue:leave
  // -------------------------------------------------------------------------

  socket.on("boss:queue:leave", () => {
    const timer = queueTimeouts.get(userId);
    if (timer) {
      clearTimeout(timer);
      queueTimeouts.delete(userId);
    }

    removeFromBossQueue(userId);
    socket.emit("boss:queue:left", {
      message: "Saiu da fila de boss fight",
    });
    console.log(`[Socket.io] ${userId} saiu da fila de boss fight`);
  });

  // -------------------------------------------------------------------------
  // boss:match:accept
  // -------------------------------------------------------------------------

  socket.on("boss:match:accept", (payload: unknown) => {
    if (!isValidBattleIdPayload(payload)) {
      socket.emit("boss:queue:error", {
        message: "Payload invalido para boss:match:accept",
      });
      return;
    }

    const { battleId } = payload;
    const session = getBossBattle(battleId);

    if (!session) {
      socket.emit("boss:queue:error", {
        message: "Sessao de boss fight nao encontrada",
      });
      return;
    }

    if (!session.playerSockets.has(userId)) {
      socket.emit("boss:queue:error", {
        message: "Voce nao pertence a esta sessao",
      });
      return;
    }

    if (session.matchAccepted.has(userId)) {
      socket.emit("boss:queue:error", {
        message: "Voce ja aceitou esta boss fight",
      });
      return;
    }

    session.matchAccepted.add(userId);
    session.lastActivityAt = Date.now();

    if (session.matchAccepted.size === 3) {
      // Todos aceitaram
      if (session.matchTimer) {
        clearTimeout(session.matchTimer);
        session.matchTimer = null;
      }

      // Joinar sockets na room
      const roomName = `boss-battle:${battleId}`;
      for (const [, pSocketId] of session.playerSockets) {
        const pSocket = io.sockets.sockets.get(pSocketId);
        pSocket?.join(roomName);
      }

      // Criar CoopBattle no banco (fire-and-forget, upsert para evitar duplicata)
      const today = getTodayDateBRT();
      prisma.coopBattle
        .upsert({
          where: { id: battleId },
          update: {},
          create: {
            id: battleId,
            bossId: session.bossId,
            date: today,
            status: "IN_PROGRESS",
            participants: {
              create: Array.from(session.playerCategories).map(
                ([pUserId, pCategory]) => ({
                  userId: pUserId,
                  dominantCategory: pCategory,
                })
              ),
            },
          },
        })
        .catch((err) => {
          console.log(
            `[Socket.io] Erro ao criar registro de boss battle ${battleId}: ${String(err)}`
          );
        });

      // Emitir boss:battle:start — o frontend usa boss:battle:request-state
      // para obter o estado completo, mas enviamos info basica para o redirect
      io.to(roomName).emit("boss:battle:start", {
        battleId,
        bossName: session.bossName,
      });

      // Turn timer sera iniciado quando os players carregarem a pagina
      // (via boss:battle:request-state no boss-battle handler)

      console.log(`[Socket.io] Boss battle ${battleId} iniciada (aguardando players carregarem)`);
    } else {
      // Notificar contagem
      io.to(Array.from(session.playerSockets.values())).emit(
        "boss:match:accepted",
        {
          accepted: session.matchAccepted.size,
          total: 3,
        }
      );
    }
  });

  // -------------------------------------------------------------------------
  // boss:match:decline
  // -------------------------------------------------------------------------

  socket.on("boss:match:decline", (payload: unknown) => {
    if (!isValidBattleIdPayload(payload)) {
      socket.emit("boss:queue:error", {
        message: "Payload invalido para boss:match:decline",
      });
      return;
    }

    const { battleId } = payload;
    const session = getBossBattle(battleId);

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
      pSocket?.emit("boss:match:cancelled", {
        message: "Um jogador recusou a boss fight.",
      });

      // Devolver quem aceitou para a fila
      if (session.matchAccepted.has(pUserId)) {
        // Reconstruir entry para readicionar na fila
        const playerState = session.state.team.find(
          (p) => p.playerId === pUserId
        );
        const playerCategory = session.playerCategories.get(pUserId);
        if (playerState && playerCategory) {
          addToBossQueue({
            userId: pUserId,
            socketId: pSocketId,
            characterId: playerState.characterId,
            stats: playerState.baseStats,
            skills: playerState.equippedSkills,
            dominantCategory: playerCategory,
            joinedAt: Date.now(),
          });
        }
      }
    }

    removeBossBattle(battleId);
    console.log(
      `[Socket.io] Boss match ${battleId} cancelado: ${userId} recusou`
    );
  });

  // -------------------------------------------------------------------------
  // disconnect
  // -------------------------------------------------------------------------

  socket.on("disconnect", () => {
    // Se na fila: remover + limpar timeout
    const timer = queueTimeouts.get(userId);
    if (timer) {
      clearTimeout(timer);
      queueTimeouts.delete(userId);
    }
    removeFromBossQueue(userId);

    // Se em match pendente: tratar como decline
    const result = getPlayerBossBattle(userId);
    if (result && result.session.matchTimer) {
      // Match ainda pendente — tratar como decline
      const { battleId, session } = result;

      if (session.matchTimer) {
        clearTimeout(session.matchTimer);
        session.matchTimer = null;
      }

      for (const [pUserId, pSocketId] of session.playerSockets) {
        if (pUserId === userId) continue;
        const pSocket = io.sockets.sockets.get(pSocketId);
        pSocket?.emit("boss:match:cancelled", {
          message: "Um jogador desconectou durante a selecao.",
        });

        if (session.matchAccepted.has(pUserId)) {
          const playerState = session.state.team.find(
            (p) => p.playerId === pUserId
          );
          const playerCategory = session.playerCategories.get(pUserId);
          if (playerState && playerCategory) {
            addToBossQueue({
              userId: pUserId,
              socketId: pSocketId,
              characterId: playerState.characterId,
              stats: playerState.baseStats,
              skills: playerState.equippedSkills,
              dominantCategory: playerCategory,
              joinedAt: Date.now(),
            });
          }
        }
      }

      removeBossBattle(battleId);
      console.log(
        `[Socket.io] Boss match ${battleId} cancelado: ${userId} desconectou durante aceite`
      );
    }
    // Batalha ativa: delegado para boss-battle handler via disconnect
  });
}
