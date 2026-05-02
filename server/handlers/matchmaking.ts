// server/handlers/matchmaking.ts — Fila e emparelhamento PvP

import crypto from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { BaseStats, EquippedSkill } from "../../lib/battle/types";
import { initBattle } from "../../lib/battle/init";
import {
  addToQueue,
  removeFromQueue,
  findMatch,
  isInQueue,
} from "../stores/queue-store";
import { prisma } from "../lib/prisma";
import { setPvpBattle, getPlayerBattle } from "../stores/pvp-store";
import { sanitizeStateForPlayer } from "./battle";
import { isInBossQueue } from "../stores/boss-queue-store";
import { getPlayerBossBattle } from "../stores/boss-battle-store";
import { isInCoopPveQueue } from "../stores/coop-pve-queue-store";
import { getPlayerCoopPveBattle } from "../stores/coop-pve-battle-store";
import type { PvpBattleSession } from "../stores/pvp-store";
import { startTurnTimer } from "./battle";
import {
  convertToEquippedSkills,
  extractBaseStats,
  CHARACTER_SKILLS_SELECT,
} from "../lib/convert-skills";
import { loadEquippedCardsAndApply } from "../../lib/cards/load-equipped";

type JoinPayload = {
  characterId: string;
  stats: BaseStats;
  skills: EquippedSkill[];
};

function isValidStats(stats: unknown): stats is BaseStats {
  if (typeof stats !== "object" || stats === null) return false;
  const s = stats as Record<string, unknown>;
  return (
    typeof s.physicalAtk === "number" &&
    typeof s.physicalDef === "number" &&
    typeof s.magicAtk === "number" &&
    typeof s.magicDef === "number" &&
    typeof s.hp === "number" &&
    typeof s.speed === "number"
  );
}

function isValidSkills(skills: unknown): skills is EquippedSkill[] {
  if (!Array.isArray(skills)) return false;
  if (skills.length < 1 || skills.length > 4) return false;
  return skills.every(
    (s: unknown) =>
      typeof s === "object" &&
      s !== null &&
      typeof (s as Record<string, unknown>).skillId === "string" &&
      typeof (s as Record<string, unknown>).slotIndex === "number" &&
      typeof (s as Record<string, unknown>).skill === "object"
  );
}

function isValidJoinPayload(payload: unknown): payload is JoinPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.characterId === "string" &&
    isValidStats(p.stats) &&
    isValidSkills(p.skills)
  );
}

/** Busca character com stats e skills equipadas do banco */
async function fetchCharacterForBattle(userId: string) {
  return prisma.character.findUnique({
    where: { userId },
    select: {
      id: true,
      physicalAtk: true,
      physicalDef: true,
      magicAtk: true,
      magicDef: true,
      hp: true,
      speed: true,
      characterSkills: CHARACTER_SKILLS_SELECT,
    },
  });
}

export function registerMatchmakingHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  socket.on("matchmaking:join", async (payload: unknown) => {
    if (!isValidJoinPayload(payload)) {
      socket.emit("matchmaking:error", {
        message: "Payload invalido para matchmaking:join",
      });
      return;
    }

    if (isInQueue(userId)) {
      socket.emit("matchmaking:error", {
        message: "Voce ja esta na fila de matchmaking",
      });
      return;
    }

    if (getPlayerBattle(userId)) {
      socket.emit("matchmaking:error", {
        message: "Voce ja esta em uma batalha ativa",
      });
      return;
    }

    if (isInBossQueue(userId)) {
      socket.emit("matchmaking:error", {
        message: "Voce ja esta na fila de boss fight",
      });
      return;
    }

    if (getPlayerBossBattle(userId)) {
      socket.emit("matchmaking:error", {
        message: "Voce ja esta em uma boss fight ativa",
      });
      return;
    }

    if (isInCoopPveQueue(userId)) {
      socket.emit("matchmaking:error", {
        message: "Voce ja esta na fila de batalha coop PvE",
      });
      return;
    }

    const activeCoopPve = getPlayerCoopPveBattle(userId);
    if (activeCoopPve) {
      socket.emit("matchmaking:error", {
        message: "Voce ja esta em uma batalha coop PvE ativa",
      });
      return;
    }

    // Buscar character real do banco (ignora stats/skills do payload do client)
    const character = await fetchCharacterForBattle(userId);

    if (!character || character.characterSkills.length === 0) {
      socket.emit("matchmaking:error", {
        message: "Personagem nao encontrado ou sem skills equipadas",
      });
      return;
    }

    const verifiedEquipped = await loadEquippedCardsAndApply(
      prisma,
      userId,
      extractBaseStats(character),
    );
    const verifiedStats = verifiedEquipped.baseStats;
    const verifiedSkills = convertToEquippedSkills(character.characterSkills);
    const verifiedSpectral = verifiedEquipped.spectralSkill;

    const match = findMatch(userId);

    if (match) {
      // Verificar se o socket do oponente ainda existe
      const matchSocket = io.sockets.sockets.get(match.socketId);

      if (!matchSocket) {
        console.log(
          `[Socket.io] Oponente ${match.userId} desconectou enquanto esperava na fila, colocando ${userId} na fila`
        );

        addToQueue({
          userId,
          socketId: socket.id,
          characterId: character.id,
          stats: verifiedStats,
          skills: verifiedSkills,
          spectralSkill: verifiedSpectral,
          joinedAt: Date.now(),
        });

        socket.emit("matchmaking:waiting", {
          message: "Aguardando oponente...",
        });

        return;
      }

      // Rebuscar stats/skills atualizados do oponente do banco
      const matchCharacter = await fetchCharacterForBattle(match.userId);

      if (!matchCharacter || matchCharacter.characterSkills.length === 0) {
        console.log(
          `[Socket.io] Oponente ${match.userId} sem personagem/skills validos, colocando ${userId} na fila`
        );

        // Re-adicionar oponente na fila para nao ficar no limbo
        // (findMatch ja o removeu)
        if (matchSocket) {
          addToQueue({
            userId: match.userId,
            socketId: match.socketId,
            characterId: match.characterId,
            stats: match.stats,
            skills: match.skills,
            spectralSkill: match.spectralSkill,
            joinedAt: match.joinedAt,
          });
        }

        addToQueue({
          userId,
          socketId: socket.id,
          characterId: character.id,
          stats: verifiedStats,
          skills: verifiedSkills,
          spectralSkill: verifiedSpectral,
          joinedAt: Date.now(),
        });

        socket.emit("matchmaking:waiting", {
          message: "Aguardando oponente...",
        });

        return;
      }

      const freshMatchEquipped = await loadEquippedCardsAndApply(
        prisma,
        match.userId,
        extractBaseStats(matchCharacter),
      );
      const freshMatchStats = freshMatchEquipped.baseStats;
      const freshMatchSkills = convertToEquippedSkills(matchCharacter.characterSkills);
      const freshMatchSpectral = freshMatchEquipped.spectralSkill;

      const battleId = crypto.randomUUID();

      const state = initBattle({
        battleId,
        player1: {
          userId: match.userId,
          characterId: matchCharacter.id,
          stats: freshMatchStats,
          skills: freshMatchSkills,
          spectralSkill: freshMatchSpectral,
        },
        player2: {
          userId,
          characterId: character.id,
          stats: verifiedStats,
          skills: verifiedSkills,
          spectralSkill: verifiedSpectral,
        },
      });

      const session: PvpBattleSession = {
        state,
        player1SocketId: match.socketId,
        player2SocketId: socket.id,
        pendingActions: new Map(),
        turnTimer: null,
        disconnectedPlayer: null,
      };

      setPvpBattle(battleId, session);

      try {
        await prisma.battle.create({
          data: {
            id: battleId,
            player1Id: match.userId,
            player2Id: userId,
            status: "IN_PROGRESS",
          },
        });
      } catch (err) {
        console.error(
          `[Socket.io] Erro ao criar registro de batalha ${battleId}: ${String(err)}`
        );
        // Batalha in-memory ja existe, persistencia final pode falhar
        // mas nao impede o jogo de funcionar
      }

      matchSocket.join(battleId);
      socket.join(battleId);

      io.to(battleId).emit("matchmaking:found", { battleId });

      // Enviar estado inicial sanitizado para cada jogador
      matchSocket.emit("battle:state", {
        state: sanitizeStateForPlayer(state, match.userId),
        events: [],
      });
      socket.emit("battle:state", {
        state: sanitizeStateForPlayer(state, userId),
        events: [],
      });

      console.log(
        `[Socket.io] Match encontrado: ${match.userId} vs ${userId} -> batalha ${battleId}`
      );

      startTurnTimer(io, battleId, session);
    } else {
      addToQueue({
        userId,
        socketId: socket.id,
        characterId: character.id,
        stats: verifiedStats,
        skills: verifiedSkills,
        spectralSkill: verifiedSpectral,
        joinedAt: Date.now(),
      });

      socket.emit("matchmaking:waiting", {
        message: "Aguardando oponente...",
      });

      console.log(`[Socket.io] ${userId} entrou na fila de matchmaking`);
    }
  });

  socket.on("matchmaking:cancel", () => {
    removeFromQueue(userId);
    socket.emit("matchmaking:cancelled", {
      message: "Saiu da fila de matchmaking",
    });
    console.log(`[Socket.io] ${userId} saiu da fila de matchmaking`);
  });
}

export function handleMatchmakingDisconnect(
  _io: Server,
  _socket: Socket,
  userId: string,
): void {
  removeFromQueue(userId);
}
