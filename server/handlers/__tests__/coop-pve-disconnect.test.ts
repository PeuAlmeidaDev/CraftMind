// Testes do fix Bug 1 — Batalha encerra quando jogador desconecta permanentemente
//
// Estrategia: testar o fluxo de desconexao usando o store diretamente + fake timers
// para simular a expiracao do grace period, verificando que o estado muda para FINISHED
// e que o evento correto e emitido.

import {
  setCoopPveBattle,
  getCoopPveBattle,
  removeCoopPveBattle,
  getPlayerCoopPveBattle,
} from "../../stores/coop-pve-battle-store";
import { registerCoopPveBattleHandlers } from "../coop-pve-battle";
import type { CoopPveBattleSession, CoopPveBattleState } from "../../../lib/battle/coop-pve-types";
import type { Server, Socket } from "socket.io";

// Mock prisma para persistCoopPveResult (fire-and-forget)
vi.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn().mockResolvedValue(undefined),
    pveBattle: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    character: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCoopPveState(
  battleId: string,
  playerIds: [string, string],
  overrides?: Partial<CoopPveBattleState>,
): CoopPveBattleState {
  return {
    battleId,
    turnNumber: 1,
    team: playerIds.map((id) => ({
      playerId: id,
      characterId: `char-${id}`,
      baseStats: { physicalAtk: 20, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 200, speed: 12 },
      currentHp: 200,
      stages: { physicalAtk: 0, physicalDef: 0, magicAtk: 0, magicDef: 0, speed: 0, accuracy: 0 },
      statusEffects: [],
      activeBuffs: [],
      vulnerabilities: [],
      counters: [],
      equippedSkills: [],
      cooldowns: {},
      comboTracker: { lastSkillId: null, consecutiveUses: 0 },
      priority: 0,
    })),
    mobs: [],
    mode: "2v3",
    status: "IN_PROGRESS",
    result: "PENDING",
    turnLog: [],
    ...overrides,
  };
}

function makeSession(
  battleId: string,
  playerIds: [string, string],
  overrides?: Partial<CoopPveBattleSession>,
): CoopPveBattleSession {
  return {
    battleId,
    state: makeCoopPveState(battleId, playerIds),
    mobConfigs: [],
    playerSockets: new Map([
      [playerIds[0], `socket-${playerIds[0]}`],
      [playerIds[1], `socket-${playerIds[1]}`],
    ]),
    playerNames: new Map([
      [playerIds[0], `Player ${playerIds[0]}`],
      [playerIds[1], `Player ${playerIds[1]}`],
    ]),
    playerAvatars: new Map([
      [playerIds[0], null],
      [playerIds[1], null],
    ]),
    playerHouses: new Map([
      [playerIds[0], "Lycus"],
      [playerIds[1], "Lycus"],
    ]),
    pendingActions: new Map(),
    turnTimer: null,
    matchAccepted: new Set(playerIds),
    matchTimer: null,
    disconnectedPlayers: new Map(),
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

type EventHandler = (...args: unknown[]) => void;

function createMockSocket(userId: string, socketId: string): {
  socket: Socket;
  handlers: Map<string, EventHandler>;
} {
  const handlers = new Map<string, EventHandler>();

  const socket = {
    id: socketId,
    data: { userId },
    join: vi.fn(),
    emit: vi.fn(),
    on: vi.fn((event: string, handler: EventHandler) => {
      handlers.set(event, handler);
    }),
  } as unknown as Socket;

  return { socket, handlers };
}

function createMockIo(): {
  io: Server;
  emittedToRoom: Array<{ room: string; event: string; payload: unknown }>;
} {
  const emittedToRoom: Array<{ room: string; event: string; payload: unknown }> = [];

  const io = {
    to: vi.fn((room: string) => ({
      emit: vi.fn((event: string, payload: unknown) => {
        emittedToRoom.push({ room, event, payload });
      }),
    })),
    sockets: {
      sockets: new Map<string, Socket>(),
    },
  } as unknown as Server;

  return { io, emittedToRoom };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("coop-pve disconnect handler (Bug 1)", () => {
  const trackedBattleIds: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const id of trackedBattleIds) {
      removeCoopPveBattle(id);
    }
    trackedBattleIds.length = 0;
  });

  describe("quando grace period expira (desconexao permanente)", () => {
    it("marca a batalha como FINISHED com resultado DEFEAT", () => {
      const battleId = "battle-dc-1";
      const session = makeSession(battleId, ["p1", "p2"]);
      trackedBattleIds.push(battleId);
      setCoopPveBattle(battleId, session);

      const { io, emittedToRoom } = createMockIo();
      const { socket, handlers } = createMockSocket("p1", `socket-p1`);

      // Registrar handlers no socket
      registerCoopPveBattleHandlers(io, socket);

      // Simular disconnect
      const disconnectHandler = handlers.get("disconnect");
      expect(disconnectHandler).toBeDefined();
      disconnectHandler!();

      // Verificar que grace period foi iniciado
      expect(session.disconnectedPlayers.has("p1")).toBe(true);

      // Avancar 30 segundos (grace period)
      vi.advanceTimersByTime(30_000);

      // Verificar que o estado foi marcado como FINISHED/DEFEAT
      // A batalha pode ter sido removida do store apos finalizacao
      const battleAfter = getCoopPveBattle(battleId);
      // Se foi removida, a finalizacao ocorreu corretamente
      if (battleAfter) {
        expect(battleAfter.state.status).toBe("FINISHED");
        expect(battleAfter.state.result).toBe("DEFEAT");
      }

      // Verificar que o evento battle:end foi emitido
      const endEvents = emittedToRoom.filter(
        (e) => e.event === "coop-pve:battle:end"
      );
      expect(endEvents.length).toBeGreaterThanOrEqual(1);

      const endPayload = endEvents[0].payload as { result: string; message?: string };
      expect(endPayload.result).toBe("DEFEAT");
    });

    it("emite coop-pve:battle:end para o room da batalha", () => {
      const battleId = "battle-dc-2";
      const session = makeSession(battleId, ["p3", "p4"]);
      trackedBattleIds.push(battleId);
      setCoopPveBattle(battleId, session);

      const { io, emittedToRoom } = createMockIo();
      const { socket, handlers } = createMockSocket("p3", `socket-p3`);

      registerCoopPveBattleHandlers(io, socket);

      const disconnectHandler = handlers.get("disconnect");
      disconnectHandler!();

      vi.advanceTimersByTime(30_000);

      const endEvents = emittedToRoom.filter(
        (e) => e.event === "coop-pve:battle:end"
      );
      expect(endEvents.length).toBeGreaterThanOrEqual(1);
      expect(endEvents[0].room).toBe(`coop-pve-battle:${battleId}`);
    });

    it("remove a batalha do store apos finalizacao", () => {
      const battleId = "battle-dc-3";
      const session = makeSession(battleId, ["p5", "p6"]);
      trackedBattleIds.push(battleId);
      setCoopPveBattle(battleId, session);

      const { io } = createMockIo();
      const { socket, handlers } = createMockSocket("p5", `socket-p5`);

      registerCoopPveBattleHandlers(io, socket);

      const disconnectHandler = handlers.get("disconnect");
      disconnectHandler!();

      vi.advanceTimersByTime(30_000);

      // Batalha deve ter sido removida do store
      expect(getCoopPveBattle(battleId)).toBeUndefined();
    });

    it("emite evento player-disconnected ao iniciar grace period", () => {
      const battleId = "battle-dc-4";
      const session = makeSession(battleId, ["p7", "p8"]);
      trackedBattleIds.push(battleId);
      setCoopPveBattle(battleId, session);

      const { io, emittedToRoom } = createMockIo();
      const { socket, handlers } = createMockSocket("p7", `socket-p7`);

      registerCoopPveBattleHandlers(io, socket);

      const disconnectHandler = handlers.get("disconnect");
      disconnectHandler!();

      // Antes do grace expirar, deve ter emitido player-disconnected
      const dcEvents = emittedToRoom.filter(
        (e) => e.event === "coop-pve:battle:player-disconnected"
      );
      expect(dcEvents.length).toBe(1);

      const dcPayload = dcEvents[0].payload as { playerId: string; gracePeriodMs: number };
      expect(dcPayload.playerId).toBe("p7");
      expect(dcPayload.gracePeriodMs).toBe(30_000);
    });
  });

  describe("quando jogador nao esta em batalha", () => {
    it("disconnect nao causa erro", () => {
      const { io } = createMockIo();
      const { socket, handlers } = createMockSocket("sem-batalha", "socket-sem");

      registerCoopPveBattleHandlers(io, socket);

      const disconnectHandler = handlers.get("disconnect");
      expect(() => disconnectHandler!()).not.toThrow();
    });
  });

  describe("quando batalha ja esta FINISHED", () => {
    it("disconnect nao inicia grace period", () => {
      const battleId = "battle-dc-finished";
      const session = makeSession(battleId, ["pf1", "pf2"]);
      session.state.status = "FINISHED";
      session.state.result = "VICTORY";
      trackedBattleIds.push(battleId);
      setCoopPveBattle(battleId, session);

      const { io, emittedToRoom } = createMockIo();
      const { socket, handlers } = createMockSocket("pf1", `socket-pf1`);

      registerCoopPveBattleHandlers(io, socket);

      const disconnectHandler = handlers.get("disconnect");
      disconnectHandler!();

      // Nao deve emitir player-disconnected porque status !== IN_PROGRESS
      // E tambem getPlayerCoopPveBattle ignora FINISHED (Bug 3 fix)
      const dcEvents = emittedToRoom.filter(
        (e) => e.event === "coop-pve:battle:player-disconnected"
      );
      expect(dcEvents.length).toBe(0);
    });
  });
});
