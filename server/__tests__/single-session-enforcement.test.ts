// Testes do enforcement "1 sessao Socket.io ativa por conta" (anti multi-account).
//
// Comportamento esperado em server/index.ts (io.on("connection", ...)):
// 1. Antes de `registerSocket(userId, socketId)`, verifica se ha sockets
//    existentes para esse userId via `getSocketIds(userId)`.
// 2. Se houver: para cada socketId antigo, busca o socket ativo no io,
//    emite `session:replaced` com `{ reason: string }` e chama
//    `socket.disconnect(true)`.
// 3. Em seguida registra o novo socket normalmente.
// 4. Disconnect normal continua chamando `unregisterSocket` (limpa o mapa).
// 5. Conexao de OUTRO userId nao afeta sessoes ja registradas.
//
// Importante: NAO importar `server/index.ts` (top-level efetua dotenv config()
// e tenta subir HTTP server). Reproduzimos a logica em uma funcao local
// `simulateConnection()` e testamos contra os mesmos modulos
// (`stores/user-store.ts`) usados pelo server.

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Server, Socket } from "socket.io";
import {
  registerSocket,
  unregisterSocket,
  getSocketIds,
} from "../stores/user-store";

// ---------------------------------------------------------------------------
// Tipos auxiliares e mocks
// ---------------------------------------------------------------------------

type EmittedEvent = { event: string; payload: unknown };

interface MockSocket {
  id: string;
  data: { userId: string };
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  emitted: EmittedEvent[];
  disconnected: boolean;
}

function createMockSocket(userId: string, socketId: string): MockSocket {
  const emitted: EmittedEvent[] = [];
  const socket: MockSocket = {
    id: socketId,
    data: { userId },
    emitted,
    disconnected: false,
    emit: vi.fn((event: string, payload?: unknown) => {
      emitted.push({ event, payload });
      return true;
    }),
    disconnect: vi.fn(function (this: MockSocket) {
      this.disconnected = true;
      return this as unknown as Socket;
    }),
  };
  // bind disconnect to the socket itself (so `this.disconnected` works)
  socket.disconnect = vi.fn(() => {
    socket.disconnected = true;
    return socket as unknown as Socket;
  });
  return socket;
}

interface MockIo {
  sockets: { sockets: Map<string, Socket> };
}

function createMockIo(): MockIo {
  return {
    sockets: { sockets: new Map<string, Socket>() },
  };
}

/**
 * Reproduz a logica do `io.on("connection", ...)` em server/index.ts
 * relacionada ao enforcement de 1 sessao por conta. Mantida em sincronia
 * com o codigo de producao.
 */
function simulateConnection(io: MockIo, socket: MockSocket): void {
  const userId = socket.data.userId;

  const existingSockets = getSocketIds(userId);
  if (existingSockets && existingSockets.size > 0) {
    for (const oldSocketId of existingSockets) {
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.emit("session:replaced", {
          reason: "Sua conta foi acessada em outro dispositivo.",
        });
        oldSocket.disconnect(true);
      }
    }
  }

  registerSocket(userId, socket.id);
}

// ---------------------------------------------------------------------------
// Helpers para limpar a store entre testes
// ---------------------------------------------------------------------------

function resetUserStore(): void {
  // user-store mantem um Map module-level. Limpamos varrendo todas as entradas.
  // Como nao ha export de "clear", usamos a sequencia de unregister para os
  // userIds usados nos testes.
  for (const uid of ["user-1", "user-2", "user-3"]) {
    const ids = getSocketIds(uid);
    if (ids) {
      for (const sid of [...ids]) {
        unregisterSocket(uid, sid);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetUserStore();
});

describe("Single session enforcement (anti multi-account)", () => {
  it("1a conexao de um userId registra normalmente sem disparar nada", () => {
    const io = createMockIo();
    const socketA = createMockSocket("user-1", "socket-A");
    io.sockets.sockets.set(socketA.id, socketA as unknown as Socket);

    simulateConnection(io, socketA);

    expect(socketA.emitted).toHaveLength(0);
    expect(socketA.disconnected).toBe(false);
    expect(getSocketIds("user-1")?.has("socket-A")).toBe(true);
    expect(getSocketIds("user-1")?.size).toBe(1);
  });

  it("2a conexao do MESMO userId derruba a 1a com session:replaced", () => {
    const io = createMockIo();
    const socketA = createMockSocket("user-1", "socket-A");
    io.sockets.sockets.set(socketA.id, socketA as unknown as Socket);
    simulateConnection(io, socketA);

    const socketB = createMockSocket("user-1", "socket-B");
    io.sockets.sockets.set(socketB.id, socketB as unknown as Socket);
    simulateConnection(io, socketB);

    // Socket antigo recebeu session:replaced + disconnect
    expect(socketA.emit).toHaveBeenCalledWith(
      "session:replaced",
      expect.objectContaining({
        reason: expect.any(String),
      })
    );
    expect(socketA.disconnect).toHaveBeenCalledWith(true);
    expect(socketA.disconnected).toBe(true);

    // Socket novo nao foi tocado
    expect(socketB.emitted).toHaveLength(0);
    expect(socketB.disconnected).toBe(false);

    // Mapa contem ambos (a limpeza do antigo so acontece via disconnect handler
    // real do server, que aqui nao simulamos — o que importa e que o NOVO foi
    // registrado).
    expect(getSocketIds("user-1")?.has("socket-B")).toBe(true);
  });

  it("payload de session:replaced inclui campo `reason` em portugues", () => {
    const io = createMockIo();
    const socketA = createMockSocket("user-1", "socket-A");
    io.sockets.sockets.set(socketA.id, socketA as unknown as Socket);
    simulateConnection(io, socketA);

    const socketB = createMockSocket("user-1", "socket-B");
    io.sockets.sockets.set(socketB.id, socketB as unknown as Socket);
    simulateConnection(io, socketB);

    const replacedEvent = socketA.emitted.find((e) => e.event === "session:replaced");
    expect(replacedEvent).toBeDefined();
    const payload = replacedEvent?.payload as { reason: string };
    expect(typeof payload.reason).toBe("string");
    expect(payload.reason.length).toBeGreaterThan(0);
  });

  it("disconnect normal limpa o mapa via unregisterSocket", () => {
    const io = createMockIo();
    const socketA = createMockSocket("user-1", "socket-A");
    io.sockets.sockets.set(socketA.id, socketA as unknown as Socket);
    simulateConnection(io, socketA);

    expect(getSocketIds("user-1")?.size).toBe(1);

    // Simula o disconnect handler do server (chama unregisterSocket).
    unregisterSocket("user-1", "socket-A");

    expect(getSocketIds("user-1")).toBeUndefined();
  });

  it("conexao de OUTRO userId nao afeta sessoes existentes", () => {
    const io = createMockIo();

    const socketA = createMockSocket("user-1", "socket-A");
    io.sockets.sockets.set(socketA.id, socketA as unknown as Socket);
    simulateConnection(io, socketA);

    const socketC = createMockSocket("user-2", "socket-C");
    io.sockets.sockets.set(socketC.id, socketC as unknown as Socket);
    simulateConnection(io, socketC);

    // socketA continua registrado e nao recebeu nenhum evento
    expect(socketA.emitted).toHaveLength(0);
    expect(socketA.disconnected).toBe(false);
    expect(getSocketIds("user-1")?.has("socket-A")).toBe(true);
    expect(getSocketIds("user-2")?.has("socket-C")).toBe(true);
  });

  it("se o socket antigo nao existe mais no io.sockets, nao explode", () => {
    const io = createMockIo();

    // Registra manualmente um socketId que NAO existe no io.sockets.sockets
    // (simula caso onde socket cai antes do disconnect handler limpar a store).
    registerSocket("user-1", "ghost-socket");

    const socketB = createMockSocket("user-1", "socket-B");
    io.sockets.sockets.set(socketB.id, socketB as unknown as Socket);

    expect(() => simulateConnection(io, socketB)).not.toThrow();

    // Novo socket foi registrado normalmente
    expect(getSocketIds("user-1")?.has("socket-B")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Verificacao estrutural: server/index.ts contem a logica esperada
// ---------------------------------------------------------------------------

describe("server/index.ts — verificacao estrutural", () => {
  it("contem a logica de kick antes de registerSocket", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const indexPath = path.resolve(__dirname, "..", "index.ts");
    const source = fs.readFileSync(indexPath, "utf-8");

    // Ordem importante: o kick deve vir ANTES de registerSocket(userId, socket.id)
    const kickIdx = source.indexOf("session:replaced");
    const registerIdx = source.indexOf("registerSocket(userId, socket.id)");

    expect(kickIdx).toBeGreaterThanOrEqual(0);
    expect(registerIdx).toBeGreaterThan(kickIdx);
  });

  it("emite evento `session:replaced` com chave `reason`", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const indexPath = path.resolve(__dirname, "..", "index.ts");
    const source = fs.readFileSync(indexPath, "utf-8");

    expect(source).toContain('"session:replaced"');
    expect(source).toMatch(/reason:/);
  });

  it("chama disconnect(true) no socket antigo", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const indexPath = path.resolve(__dirname, "..", "index.ts");
    const source = fs.readFileSync(indexPath, "utf-8");

    expect(source).toMatch(/oldSocket\.disconnect\(true\)/);
  });
});
