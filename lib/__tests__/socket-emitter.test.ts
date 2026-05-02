// lib/__tests__/socket-emitter.test.ts
//
// Cobre `broadcastGlobal` (Fase 2 — Espectral) e secundariamente `emitToUser`:
//   - POST para `/internal/broadcast-spectral` com header `Authorization: Bearer <secret>`.
//   - Body JSON contendo `{ event, payload }`.
//   - Fire-and-forget: erro de rede NUNCA propaga (resolve normalmente).
//   - Resposta nao-OK e logada via console.warn mas nao throw.
//   - Quando SOCKET_SERVER_URL ou SOCKET_INTERNAL_SECRET ausente: console.warn
//     e nao tenta o request.
//
// Estrategia: o modulo `lib/socket-emitter.ts` le `process.env.*` no MOMENTO do
// import (top-level const). Para testar a auseancia das envs precisamos resetar
// o cache de modulos com `vi.resetModules()` e re-importar dinamicamente.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };

function makeFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(""),
  });
}

function makeFetchNonOk(status = 500, text = "boom"): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(text),
  });
}

function makeFetchThrows(error: Error): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(error);
}

/**
 * Carrega o modulo socket-emitter com envs frescas. Necessario porque o modulo
 * captura `SOCKET_SERVER_URL` e `INTERNAL_SECRET` em const no top-level.
 */
async function loadModuleWithEnv(envOverrides: Record<string, string | undefined>): Promise<{
  broadcastGlobal: typeof import("../socket-emitter").broadcastGlobal;
  emitToUser: typeof import("../socket-emitter").emitToUser;
}> {
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  vi.resetModules();
  const mod = await import("../socket-emitter");
  return { broadcastGlobal: mod.broadcastGlobal, emitToUser: mod.emitToUser };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  // Restaura envs e fetch original entre testes.
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) delete process.env[k];
  }
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    process.env[k] = v;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  warnSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// broadcastGlobal
// ---------------------------------------------------------------------------

describe("broadcastGlobal", () => {
  describe("quando ambas as envs estao configuradas", () => {
    it("faz POST para /internal/broadcast-spectral com header Authorization correto", async () => {
      const fetchMock = makeFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const { broadcastGlobal } = await loadModuleWithEnv({
        SOCKET_SERVER_URL: "http://socket.test:3001",
        SOCKET_INTERNAL_SECRET: "super-secret-token",
      });

      await broadcastGlobal("global:spectral-drop", {
        userId: "u1",
        userName: "Pedro",
        cardName: "Cristal X",
        mobName: "Slime",
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://socket.test:3001/internal/broadcast-spectral");
      expect(init.method).toBe("POST");

      // Headers podem ser objeto Record OU instancia de Headers — checar por nome.
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Authorization"]).toBe("Bearer super-secret-token");
    });

    it("inclui event + payload arbitrarios no body", async () => {
      const fetchMock = makeFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const { broadcastGlobal } = await loadModuleWithEnv({
        SOCKET_SERVER_URL: "http://socket.test:3001",
        SOCKET_INTERNAL_SECRET: "tok",
      });

      const payload = {
        userId: "abc",
        userName: "Joao",
        cardName: "Teste",
        mobName: "Mob X",
        extra: { nested: true, n: 7 },
      };
      await broadcastGlobal("custom:event", payload);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const parsed = JSON.parse(init.body as string) as {
        event: string;
        payload: Record<string, unknown>;
      };
      expect(parsed.event).toBe("custom:event");
      expect(parsed.payload).toEqual(payload);
    });

    it("aceita event arbitrario diferente de global:spectral-drop", async () => {
      const fetchMock = makeFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const { broadcastGlobal } = await loadModuleWithEnv({
        SOCKET_SERVER_URL: "http://socket.test:3001",
        SOCKET_INTERNAL_SECRET: "tok",
      });

      await expect(
        broadcastGlobal("global:other-event", { foo: "bar" }),
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("inclui AbortSignal com timeout no init", async () => {
      const fetchMock = makeFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const { broadcastGlobal } = await loadModuleWithEnv({
        SOCKET_SERVER_URL: "http://socket.test:3001",
        SOCKET_INTERNAL_SECRET: "tok",
      });

      await broadcastGlobal("ev", { x: 1 });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      // Apenas garantir que o caller passou um signal (timeout 5s).
      expect(init.signal).toBeDefined();
    });
  });

  describe("quando o fetch falha (erro de rede)", () => {
    it("NAO propaga o erro — resolve normalmente (fire-and-forget)", async () => {
      const fetchMock = makeFetchThrows(new Error("ECONNREFUSED"));
      vi.stubGlobal("fetch", fetchMock);

      const { broadcastGlobal } = await loadModuleWithEnv({
        SOCKET_SERVER_URL: "http://socket.test:3001",
        SOCKET_INTERNAL_SECRET: "tok",
      });

      await expect(
        broadcastGlobal("global:spectral-drop", { foo: "bar" }),
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("loga o erro com console.warn (nao throw)", async () => {
      const fetchMock = makeFetchThrows(new Error("network fail"));
      vi.stubGlobal("fetch", fetchMock);

      const { broadcastGlobal } = await loadModuleWithEnv({
        SOCKET_SERVER_URL: "http://socket.test:3001",
        SOCKET_INTERNAL_SECRET: "tok",
      });

      await broadcastGlobal("global:spectral-drop", { foo: "bar" });
      expect(warnSpy).toHaveBeenCalled();
      const allMsgs = warnSpy.mock.calls.map((c) => String(c[0])).join(" ");
      expect(allMsgs).toContain("Error broadcasting");
    });
  });

  describe("quando o servidor responde nao-OK", () => {
    it("NAO propaga e loga via console.warn", async () => {
      const fetchMock = makeFetchNonOk(500, "internal");
      vi.stubGlobal("fetch", fetchMock);

      const { broadcastGlobal } = await loadModuleWithEnv({
        SOCKET_SERVER_URL: "http://socket.test:3001",
        SOCKET_INTERNAL_SECRET: "tok",
      });

      await expect(
        broadcastGlobal("global:spectral-drop", { foo: "bar" }),
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
      const allMsgs = warnSpy.mock.calls.map((c) => String(c[0])).join(" ");
      expect(allMsgs).toContain("Failed to broadcast");
    });
  });

  describe("quando SOCKET_SERVER_URL esta ausente", () => {
    it("NAO faz request e loga via console.warn", async () => {
      const fetchMock = makeFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const { broadcastGlobal } = await loadModuleWithEnv({
        SOCKET_SERVER_URL: undefined,
        SOCKET_INTERNAL_SECRET: "tok",
      });

      await broadcastGlobal("global:spectral-drop", { foo: "bar" });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      const allMsgs = warnSpy.mock.calls.map((c) => String(c[0])).join(" ");
      expect(allMsgs).toContain("not configured");
    });
  });

  describe("quando SOCKET_INTERNAL_SECRET esta ausente", () => {
    it("NAO faz request e loga via console.warn", async () => {
      const fetchMock = makeFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const { broadcastGlobal } = await loadModuleWithEnv({
        SOCKET_SERVER_URL: "http://socket.test:3001",
        SOCKET_INTERNAL_SECRET: undefined,
      });

      await broadcastGlobal("global:spectral-drop", { foo: "bar" });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// emitToUser (smoke test — mesmo padrao fire-and-forget)
// ---------------------------------------------------------------------------

describe("emitToUser", () => {
  it("faz POST para /internal/notify com targetUserId no body", async () => {
    const fetchMock = makeFetchOk();
    vi.stubGlobal("fetch", fetchMock);

    const { emitToUser } = await loadModuleWithEnv({
      SOCKET_SERVER_URL: "http://socket.test:3001",
      SOCKET_INTERNAL_SECRET: "tok",
    });

    await emitToUser("user_42", "friend:request-received", { from: "abc" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://socket.test:3001/internal/notify");
    const parsed = JSON.parse(init.body as string) as {
      targetUserId: string;
      event: string;
      payload: Record<string, unknown>;
    };
    expect(parsed.targetUserId).toBe("user_42");
    expect(parsed.event).toBe("friend:request-received");
    expect(parsed.payload).toEqual({ from: "abc" });
  });

  it("NAO propaga erro de rede (fire-and-forget)", async () => {
    const fetchMock = makeFetchThrows(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const { emitToUser } = await loadModuleWithEnv({
      SOCKET_SERVER_URL: "http://socket.test:3001",
      SOCKET_INTERNAL_SECRET: "tok",
    });

    await expect(
      emitToUser("user_42", "ev", { foo: "bar" }),
    ).resolves.toBeUndefined();
  });
});
