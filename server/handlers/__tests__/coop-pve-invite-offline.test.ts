// Testes do fix Bug 2 — Convite nao cria batalha se sender esta offline
//
// Estrategia: mockar stores e prisma para isolar o fluxo de accept.
// O fix verifica io.sockets.sockets.get(senderSocketId) e fallback via getSocketIds.
// Se nenhum socket ativo do sender existe, rejeita o aceite.

import { registerCoopPveInviteHandlers } from "../coop-pve-invite";
import type { Server, Socket } from "socket.io";

// ---------------------------------------------------------------------------
// Mocks de stores
// ---------------------------------------------------------------------------

const mockGetInvite = vi.fn();
const mockRemoveInvite = vi.fn();
const mockSetInvite = vi.fn();
const mockGetInviteBySender = vi.fn().mockReturnValue(undefined);
const mockGetInviteByTarget = vi.fn().mockReturnValue(undefined);
const mockRemoveInvitesBySender = vi.fn();
const mockRemoveInvitesByTarget = vi.fn();

vi.mock("../../stores/coop-pve-invite-store", () => ({
  setInvite: (...args: unknown[]) => mockSetInvite(...args),
  getInvite: (...args: unknown[]) => mockGetInvite(...args),
  removeInvite: (...args: unknown[]) => mockRemoveInvite(...args),
  getInviteBySender: (...args: unknown[]) => mockGetInviteBySender(...args),
  getInviteByTarget: (...args: unknown[]) => mockGetInviteByTarget(...args),
  removeInvitesBySender: (...args: unknown[]) => mockRemoveInvitesBySender(...args),
  removeInvitesByTarget: (...args: unknown[]) => mockRemoveInvitesByTarget(...args),
}));

vi.mock("../../stores/queue-store", () => ({
  isInQueue: vi.fn().mockReturnValue(false),
}));

vi.mock("../../stores/pvp-store", () => ({
  getPlayerBattle: vi.fn().mockReturnValue(undefined),
}));

vi.mock("../../stores/boss-queue-store", () => ({
  isInBossQueue: vi.fn().mockReturnValue(false),
}));

vi.mock("../../stores/boss-battle-store", () => ({
  getPlayerBossBattle: vi.fn().mockReturnValue(undefined),
}));

vi.mock("../../stores/coop-pve-queue-store", () => ({
  isInCoopPveQueue: vi.fn().mockReturnValue(false),
}));

vi.mock("../../stores/coop-pve-battle-store", () => ({
  getPlayerCoopPveBattle: vi.fn().mockReturnValue(undefined),
  setCoopPveBattle: vi.fn(),
}));

const mockIsOnline = vi.fn().mockReturnValue(true);
const mockGetSocketIds = vi.fn();

vi.mock("../../stores/user-store", () => ({
  isOnline: (...args: unknown[]) => mockIsOnline(...args),
  getSocketIds: (...args: unknown[]) => mockGetSocketIds(...args),
}));

vi.mock("../coop-pve-battle", () => ({
  sanitizeCoopPveStateForTeam: vi.fn().mockReturnValue({}),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    friendship: { findFirst: vi.fn().mockResolvedValue(null) },
    character: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    mob: { findMany: vi.fn().mockResolvedValue([]) },
    pveBattle: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("../../lib/convert-skills", () => ({
  convertToEquippedSkills: vi.fn().mockReturnValue([]),
  extractBaseStats: vi.fn().mockReturnValue({
    physicalAtk: 20, physicalDef: 15, magicAtk: 10, magicDef: 10, hp: 200, speed: 12,
  }),
  CHARACTER_SKILLS_SELECT: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EventHandler = (...args: unknown[]) => void;

function createMockSocket(userId: string, socketId: string): {
  socket: Socket;
  handlers: Map<string, EventHandler>;
  emitted: Array<{ event: string; payload: unknown }>;
} {
  const handlers = new Map<string, EventHandler>();
  const emitted: Array<{ event: string; payload: unknown }> = [];

  const socket = {
    id: socketId,
    data: { userId },
    join: vi.fn(),
    emit: vi.fn((event: string, payload: unknown) => {
      emitted.push({ event, payload });
    }),
    on: vi.fn((event: string, handler: EventHandler) => {
      handlers.set(event, handler);
    }),
  } as unknown as Socket;

  return { socket, handlers, emitted };
}

function createMockIo(connectedSockets?: Map<string, Socket>): Server {
  return {
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
    sockets: {
      sockets: connectedSockets ?? new Map<string, Socket>(),
    },
  } as unknown as Server;
}

function makeFakeInvite(overrides?: Record<string, unknown>) {
  return {
    inviteId: "invite-1",
    senderId: "sender-user",
    senderSocketId: "sender-socket-old",
    senderName: "Sender",
    targetId: "target-user",
    mode: "2v3" as const,
    createdAt: Date.now(),
    timer: setTimeout(() => {}, 30000),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("coop-pve invite accept — sender offline (Bug 2)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("quando sender esta completamente offline", () => {
    it("emite erro e nao cria batalha", async () => {
      // Invite existe no store
      const invite = makeFakeInvite();
      mockGetInvite.mockReturnValue(invite);

      // Sender NAO tem socket ativo no io.sockets.sockets
      const connectedSockets = new Map<string, Socket>();
      // Nenhum socket do sender conectado

      const io = createMockIo(connectedSockets);

      // getSocketIds retorna undefined (sender nao tem sockets registrados)
      mockGetSocketIds.mockReturnValue(undefined);

      // Target aceita o convite
      const { socket, handlers, emitted } = createMockSocket("target-user", "target-socket");
      registerCoopPveInviteHandlers(io, socket);

      const acceptHandler = handlers.get("coop-pve:invite:accept");
      expect(acceptHandler).toBeDefined();

      await acceptHandler!({ inviteId: "invite-1" });

      // Deve emitir erro para o target
      const errorEvents = emitted.filter((e) => e.event === "coop-pve:invite:error");
      expect(errorEvents.length).toBe(1);
      expect((errorEvents[0].payload as { message: string }).message).toContain(
        "nao esta mais online"
      );

      // Deve ter removido o convite
      expect(mockRemoveInvite).toHaveBeenCalledWith("invite-1");
    });
  });

  describe("quando sender tem socketIds registrados mas nenhum socket real", () => {
    it("emite erro e nao cria batalha", async () => {
      const invite = makeFakeInvite();
      mockGetInvite.mockReturnValue(invite);

      // io.sockets.sockets nao tem o socket do sender
      const connectedSockets = new Map<string, Socket>();
      const io = createMockIo(connectedSockets);

      // getSocketIds retorna IDs que nao existem mais no io
      mockGetSocketIds.mockReturnValue(new Set(["ghost-socket-1", "ghost-socket-2"]));

      const { socket, handlers, emitted } = createMockSocket("target-user", "target-socket");
      registerCoopPveInviteHandlers(io, socket);

      const acceptHandler = handlers.get("coop-pve:invite:accept");
      await acceptHandler!({ inviteId: "invite-1" });

      const errorEvents = emitted.filter((e) => e.event === "coop-pve:invite:error");
      expect(errorEvents.length).toBe(1);
      expect((errorEvents[0].payload as { message: string }).message).toContain(
        "nao esta mais online"
      );

      expect(mockRemoveInvite).toHaveBeenCalledWith("invite-1");
    });
  });

  describe("quando convite nao existe ou expirou", () => {
    it("emite erro de convite nao encontrado", async () => {
      mockGetInvite.mockReturnValue(undefined);

      const io = createMockIo();
      const { socket, handlers, emitted } = createMockSocket("target-user", "target-socket");
      registerCoopPveInviteHandlers(io, socket);

      const acceptHandler = handlers.get("coop-pve:invite:accept");
      await acceptHandler!({ inviteId: "invite-inexistente" });

      const errorEvents = emitted.filter((e) => e.event === "coop-pve:invite:error");
      expect(errorEvents.length).toBe(1);
      expect((errorEvents[0].payload as { message: string }).message).toContain(
        "nao encontrado"
      );
    });
  });

  describe("quando payload e invalido", () => {
    it("emite erro de payload invalido", async () => {
      const io = createMockIo();
      const { socket, handlers, emitted } = createMockSocket("target-user", "target-socket");
      registerCoopPveInviteHandlers(io, socket);

      const acceptHandler = handlers.get("coop-pve:invite:accept");
      await acceptHandler!({ inviteId: "" }); // string vazia = invalido

      const errorEvents = emitted.filter((e) => e.event === "coop-pve:invite:error");
      expect(errorEvents.length).toBe(1);
      expect((errorEvents[0].payload as { message: string }).message).toContain(
        "Payload invalido"
      );
    });
  });

  describe("quando target nao e o destinatario", () => {
    it("emite erro de permissao", async () => {
      const invite = makeFakeInvite({ targetId: "outro-user" });
      mockGetInvite.mockReturnValue(invite);

      const io = createMockIo();
      const { socket, handlers, emitted } = createMockSocket("target-user", "target-socket");
      registerCoopPveInviteHandlers(io, socket);

      const acceptHandler = handlers.get("coop-pve:invite:accept");
      await acceptHandler!({ inviteId: "invite-1" });

      const errorEvents = emitted.filter((e) => e.event === "coop-pve:invite:error");
      expect(errorEvents.length).toBe(1);
      expect((errorEvents[0].payload as { message: string }).message).toContain(
        "nao e o destinatario"
      );
    });
  });
});
