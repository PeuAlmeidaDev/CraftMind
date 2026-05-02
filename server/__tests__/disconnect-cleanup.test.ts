// Testes da refatoracao do listener de "disconnect" centralizado em server/index.ts.
//
// Contexto:
// Antes da refatoracao, cada `register*Handlers` registrava seu proprio
// `socket.on("disconnect", ...)` nos 10+ handlers, causando
// `MaxListenersExceededWarning`. Agora existe apenas UM listener centralizado
// em `server/index.ts:336`, e cada handler exporta uma funcao
// `handle*Disconnect(io, socket, userId)` envolta em try/catch individual.
//
// Estes testes validam:
// 1. Cada handler expoe uma `handle*Disconnect` com a assinatura correta.
// 2. Nenhum `register*Handlers` registra um listener de "disconnect" no socket.
// 3. Cada `handle*Disconnect` e seguro de chamar em "estado vazio".
// 4. O listener centralizado em server/index.ts usa try/catch individual.
// 5. So existe UMA ocorrencia de `socket.on("disconnect"` em todo `server/`.
//
// Importante: NAO importar `server/index.ts` (top-level efetua dotenv config()
// e tenta subir HTTP server). Usamos leitura de arquivo para validacoes
// estruturais.

import fs from "node:fs";
import path from "node:path";
import type { Server, Socket } from "socket.io";

// Mock prisma para evitar conexao real ao banco em handlers que usam
// fire-and-forget (ex: persist*Result). Os handle*Disconnect em "estado vazio"
// retornam early e nao chamam prisma, mas mantemos o mock por seguranca.
vi.mock("../lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn().mockResolvedValue(undefined),
    pveBattle: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    battle: { create: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined) },
    bossBattle: { update: vi.fn().mockResolvedValue(undefined) },
    character: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

import { handleMatchmakingDisconnect, registerMatchmakingHandlers } from "../handlers/matchmaking";
import { handleBattleDisconnect, registerBattleHandlers } from "../handlers/battle";
import { handleBossMatchmakingDisconnect, registerBossMatchmakingHandlers } from "../handlers/boss-matchmaking";
import { handleBossBattleDisconnect, registerBossBattleHandlers } from "../handlers/boss-battle";
import { handleCoopPveMatchmakingDisconnect, registerCoopPveMatchmakingHandlers } from "../handlers/coop-pve-matchmaking";
import { handleCoopPveBattleDisconnect, registerCoopPveBattleHandlers } from "../handlers/coop-pve-battle";
import { handleCoopPveInviteDisconnect, registerCoopPveInviteHandlers } from "../handlers/coop-pve-invite";
import { handlePvpTeamMatchmakingDisconnect, registerPvpTeamMatchmakingHandlers } from "../handlers/pvp-team-matchmaking";
import { handlePvpTeamBattleDisconnect, registerPvpTeamBattleHandlers } from "../handlers/pvp-team-battle";
import { handlePvpTeamInviteDisconnect, registerPvpTeamInviteHandlers } from "../handlers/pvp-team-invite";

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

type DisconnectFn = (io: Server, socket: Socket, userId: string) => void;
type RegisterFn = (io: Server, socket: Socket) => void;

type EventHandler = (...args: unknown[]) => void;

interface MockSocketState {
  socket: Socket;
  onCounts: Record<string, number>;
  emitted: Array<{ event: string; payload: unknown }>;
}

interface MockIoState {
  io: Server;
  emittedToRoom: Array<{ room: string; event: string; payload: unknown }>;
}

// ---------------------------------------------------------------------------
// Helpers de mock
// ---------------------------------------------------------------------------

function createMockSocket(userId: string, socketId: string): MockSocketState {
  const onCounts: Record<string, number> = {};
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const handlers = new Map<string, EventHandler>();

  const socket = {
    id: socketId,
    data: { userId },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn((event: string, payload?: unknown) => {
      emitted.push({ event, payload });
    }),
    on: vi.fn((event: string, handler: EventHandler) => {
      onCounts[event] = (onCounts[event] ?? 0) + 1;
      handlers.set(event, handler);
    }),
  } as unknown as Socket;

  return { socket, onCounts, emitted };
}

function createMockIo(): MockIoState {
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

// Lista canonica das 10 funcoes de disconnect, no mesmo formato
// usado pelo array `cleanups` em server/index.ts.
const DISCONNECT_HANDLERS: Array<{ name: string; fn: DisconnectFn }> = [
  { name: "handleMatchmakingDisconnect", fn: handleMatchmakingDisconnect },
  { name: "handleBattleDisconnect", fn: handleBattleDisconnect },
  { name: "handleBossMatchmakingDisconnect", fn: handleBossMatchmakingDisconnect },
  { name: "handleBossBattleDisconnect", fn: handleBossBattleDisconnect },
  { name: "handleCoopPveMatchmakingDisconnect", fn: handleCoopPveMatchmakingDisconnect },
  { name: "handleCoopPveBattleDisconnect", fn: handleCoopPveBattleDisconnect },
  { name: "handleCoopPveInviteDisconnect", fn: handleCoopPveInviteDisconnect },
  { name: "handlePvpTeamMatchmakingDisconnect", fn: handlePvpTeamMatchmakingDisconnect },
  { name: "handlePvpTeamBattleDisconnect", fn: handlePvpTeamBattleDisconnect },
  { name: "handlePvpTeamInviteDisconnect", fn: handlePvpTeamInviteDisconnect },
];

// Lista canonica das 10 funcoes register*Handlers.
const REGISTER_HANDLERS: Array<{ name: string; fn: RegisterFn }> = [
  { name: "registerMatchmakingHandlers", fn: registerMatchmakingHandlers },
  { name: "registerBattleHandlers", fn: registerBattleHandlers },
  { name: "registerBossMatchmakingHandlers", fn: registerBossMatchmakingHandlers },
  { name: "registerBossBattleHandlers", fn: registerBossBattleHandlers },
  { name: "registerCoopPveMatchmakingHandlers", fn: registerCoopPveMatchmakingHandlers },
  { name: "registerCoopPveBattleHandlers", fn: registerCoopPveBattleHandlers },
  { name: "registerCoopPveInviteHandlers", fn: registerCoopPveInviteHandlers },
  { name: "registerPvpTeamMatchmakingHandlers", fn: registerPvpTeamMatchmakingHandlers },
  { name: "registerPvpTeamBattleHandlers", fn: registerPvpTeamBattleHandlers },
  { name: "registerPvpTeamInviteHandlers", fn: registerPvpTeamInviteHandlers },
];

// ---------------------------------------------------------------------------
// 1. Cada handler exporta `handle*Disconnect` com a assinatura correta
// ---------------------------------------------------------------------------

describe("handlers de disconnect — assinatura", () => {
  describe("cada `handle*Disconnect` esta exportado", () => {
    for (const entry of DISCONNECT_HANDLERS) {
      it(`${entry.name} e uma funcao`, () => {
        expect(typeof entry.fn).toBe("function");
      });
    }
  });

  describe("cada `handle*Disconnect` aceita (io, socket, userId)", () => {
    for (const entry of DISCONNECT_HANDLERS) {
      it(`${entry.name} tem aridade 3`, () => {
        // Em JS, Function.length conta parametros ate o primeiro com default.
        // Os 10 handlers tem assinatura `(io, socket, userId)` sem defaults.
        expect(entry.fn.length).toBe(3);
      });
    }
  });

  it("ha exatamente 10 handlers de disconnect cobertos", () => {
    expect(DISCONNECT_HANDLERS).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// 2. Nenhum register*Handlers registra `socket.on("disconnect", ...)`
// ---------------------------------------------------------------------------

describe("register*Handlers — nao registram listener de disconnect", () => {
  it("zero listeners de 'disconnect' apos rodar todos os 10 register*Handlers", () => {
    const { io } = createMockIo();
    const { socket, onCounts } = createMockSocket("user-test", "socket-test");

    // Simula exatamente o que `io.on("connection", ...)` faz em server/index.ts:
    // chama os 10 register*Handlers em sequencia no mesmo socket.
    for (const entry of REGISTER_HANDLERS) {
      entry.fn(io, socket);
    }

    // O listener de "disconnect" agora vive somente em server/index.ts.
    // Os register*Handlers NAO devem registrar nenhum.
    expect(onCounts.disconnect ?? 0).toBe(0);
  });

  it("os register*Handlers continuam registrando listeners de outros eventos", () => {
    // Sanity check: a refatoracao removeu APENAS os listeners de "disconnect",
    // os outros (battle:action, matchmaking:join, etc.) devem continuar.
    const { io } = createMockIo();
    const { socket, onCounts } = createMockSocket("user-sanity", "socket-sanity");

    for (const entry of REGISTER_HANDLERS) {
      entry.fn(io, socket);
    }

    const totalOtherListeners = Object.entries(onCounts)
      .filter(([event]) => event !== "disconnect")
      .reduce((acc, [, count]) => acc + count, 0);

    expect(totalOtherListeners).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. handle*Disconnect e seguro em "estado vazio"
// ---------------------------------------------------------------------------

describe("handle*Disconnect em 'estado vazio' (usuario nunca entrou em fila/batalha)", () => {
  // Cenario tipico: usuario abre o app, fecha sem fazer nada. Todos os 10
  // handlers devem rodar sem lancar.

  for (const entry of DISCONNECT_HANDLERS) {
    it(`${entry.name} nao lanca quando o userId nao esta em nenhum store`, () => {
      const { io } = createMockIo();
      const { socket } = createMockSocket(
        "user-not-in-anything",
        "socket-empty",
      );

      expect(() => entry.fn(io, socket, "user-not-in-anything")).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Listener centralizado em server/index.ts usa try/catch individual
// ---------------------------------------------------------------------------

describe("server/index.ts — listener centralizado de disconnect", () => {
  const indexPath = path.resolve(__dirname, "..", "index.ts");
  const indexSource = fs.readFileSync(indexPath, "utf-8");

  it("contem o listener `socket.on(\"disconnect\", ...)` no arquivo", () => {
    expect(indexSource).toContain('socket.on("disconnect"');
  });

  it("itera o array `cleanups` com `for (...of cleanups)`", () => {
    // Aceita variacoes de espaco entre tokens.
    expect(indexSource).toMatch(/for\s*\(\s*const\s+\[[^\]]+\]\s+of\s+cleanups\s*\)/);
  });

  it("envolve cada cleanup em try/catch individual dentro do for", () => {
    // A regiao do `for (...of cleanups)` deve conter pelo menos um `try {`
    // e um `catch` no escopo proximo.
    const forIndex = indexSource.search(/for\s*\(\s*const\s+\[[^\]]+\]\s+of\s+cleanups\s*\)/);
    expect(forIndex).toBeGreaterThanOrEqual(0);

    // Recortar do `for` ate o final do arquivo e garantir que ha try/catch
    // antes do `unregisterSocket`.
    const fromForOnward = indexSource.slice(forIndex);
    const tryIdx = fromForOnward.indexOf("try {");
    const catchIdx = fromForOnward.indexOf("} catch");
    const unregisterIdx = fromForOnward.indexOf("unregisterSocket(");

    expect(tryIdx).toBeGreaterThanOrEqual(0);
    expect(catchIdx).toBeGreaterThan(tryIdx);
    expect(unregisterIdx).toBeGreaterThan(catchIdx);
  });

  it("loga erro com a mensagem 'disconnect cleanup' quando uma cleanup falha", () => {
    expect(indexSource).toMatch(/disconnect cleanup\s+'\$\{name\}'\s+falhou/);
  });

  it("chama `unregisterSocket(userId, socket.id)` apos o for de cleanups", () => {
    const forIndex = indexSource.search(/for\s*\(\s*const\s+\[[^\]]+\]\s+of\s+cleanups\s*\)/);
    const unregisterIndex = indexSource.indexOf("unregisterSocket(userId, socket.id)");

    expect(forIndex).toBeGreaterThanOrEqual(0);
    expect(unregisterIndex).toBeGreaterThan(forIndex);
  });

  it("o array `cleanups` referencia as 10 funcoes handle*Disconnect", () => {
    for (const entry of DISCONNECT_HANDLERS) {
      expect(indexSource).toContain(entry.name);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Apenas 1 ocorrencia de `socket.on("disconnect"` em server/
// ---------------------------------------------------------------------------

describe("server/ — unicidade do listener de disconnect", () => {
  // Garante que ninguem reintroduza um listener duplicado por engano.

  function listTsFiles(dir: string): string[] {
    const out: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Excluir __tests__ e node_modules
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        out.push(...listTsFiles(full));
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        // Excluir arquivos *.test.ts
        if (entry.name.endsWith(".test.ts")) continue;
        out.push(full);
      }
    }
    return out;
  }

  const serverDir = path.resolve(__dirname, "..");
  const tsFiles = listTsFiles(serverDir);

  it("encontra arquivos .ts no diretorio server/ (sanity)", () => {
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  it("ha exatamente 1 ocorrencia de `socket.on(\"disconnect\"` em todo server/", () => {
    const occurrences: Array<{ file: string; count: number }> = [];

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // Match literal de `socket.on("disconnect"` com aspas duplas (estilo
      // canonico do projeto). Nao consideramos aspas simples.
      const matches = content.match(/socket\.on\("disconnect"/g);
      if (matches && matches.length > 0) {
        occurrences.push({ file, count: matches.length });
      }
    }

    const totalCount = occurrences.reduce((acc, o) => acc + o.count, 0);
    expect(totalCount).toBe(1);
  });

  it("a unica ocorrencia esta em server/index.ts", () => {
    const occurrences: string[] = [];

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (/socket\.on\("disconnect"/.test(content)) {
        occurrences.push(path.basename(file));
      }
    }

    expect(occurrences).toEqual(["index.ts"]);
  });
});
