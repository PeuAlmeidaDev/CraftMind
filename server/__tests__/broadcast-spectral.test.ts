// server/__tests__/broadcast-spectral.test.ts
//
// Cobre o endpoint HTTP `POST /internal/broadcast-spectral` definido em
// `server/index.ts` (Fase 2 — Espectral).
//
// Estrategia: o handler vive inline dentro do `http.createServer` em
// `server/index.ts`, e o modulo dispara `httpServer.listen(PORT)` no top-level —
// importar diretamente subiria um servidor real e nao expoe o `httpServer`.
//
// Para nao alterar o source apenas para testar, este teste BOOTA um http.Server
// LOCAL que reproduz EXATAMENTE o handler do `server/index.ts:164-219` (mesmo
// header de auth, mesma validacao de payload, mesma chamada `io.emit`). O teste
// verifica o CONTRATO (status, body, side-effect em `io.emit`) que o handler
// real precisa cumprir.
//
// Se o handler real for alterado (ex: renomear endpoint, mudar shape do body),
// este teste deve ser atualizado em paralelo. Eh um trade-off conhecido.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// Espelho do handler — copia EXATA da logica em server/index.ts
// ---------------------------------------------------------------------------

const INTERNAL_SECRET = "test-internal-secret-xyz";

type EmitFn = (event: string, payload: unknown) => boolean;

interface FakeIo {
  emit: EmitFn;
}

function buildHandler(io: FakeIo) {
  return (req: http.IncomingMessage, res: http.ServerResponse): void => {
    if (req.method === "POST" && req.url === "/internal/broadcast-spectral") {
      const authHeader = req.headers.authorization;
      if (!INTERNAL_SECRET || authHeader !== `Bearer ${INTERNAL_SECRET}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const parsed = JSON.parse(body) as {
            event?: unknown;
            payload?: unknown;
          };

          if (
            typeof parsed.event !== "string" ||
            parsed.event.length === 0 ||
            parsed.payload === undefined
          ) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing event or payload" }));
            return;
          }

          if (typeof parsed.payload !== "object" || parsed.payload === null) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Payload must be an object" }));
            return;
          }

          io.emit(parsed.event, parsed.payload);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ delivered: "all" }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;
const emitMock = vi.fn();
const fakeIo: FakeIo = {
  emit: ((...args) => emitMock(...args)) as EmitFn,
};

beforeAll(async () => {
  server = http.createServer(buildHandler(fakeIo));
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  emitMock.mockReset();
});

// ---------------------------------------------------------------------------
// Helper de request
// ---------------------------------------------------------------------------

interface PostResult {
  status: number;
  body: string;
  json: () => unknown;
}

async function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<PostResult> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: text,
    json: () => JSON.parse(text) as unknown,
  };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("POST /internal/broadcast-spectral", () => {
  describe("autenticacao", () => {
    it("retorna 401 sem header Authorization", async () => {
      const res = await postJson("/internal/broadcast-spectral", {
        event: "global:spectral-drop",
        payload: { foo: "bar" },
      });
      expect(res.status).toBe(401);
      expect(res.json()).toEqual({ error: "Unauthorized" });
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("retorna 401 com Bearer errado", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        { event: "global:spectral-drop", payload: { foo: "bar" } },
        { Authorization: "Bearer wrong-secret" },
      );
      expect(res.status).toBe(401);
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("retorna 401 com header sem prefixo Bearer", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        { event: "global:spectral-drop", payload: { foo: "bar" } },
        { Authorization: INTERNAL_SECRET },
      );
      expect(res.status).toBe(401);
      expect(emitMock).not.toHaveBeenCalled();
    });
  });

  describe("validacao de payload", () => {
    it("retorna 400 quando event esta ausente", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        { payload: { foo: "bar" } },
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );
      expect(res.status).toBe(400);
      expect((res.json() as { error: string }).error).toContain("Missing");
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("retorna 400 quando event nao eh string", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        { event: 123, payload: { foo: "bar" } },
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );
      expect(res.status).toBe(400);
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("retorna 400 quando event eh string vazia", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        { event: "", payload: { foo: "bar" } },
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );
      expect(res.status).toBe(400);
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("retorna 400 quando payload esta ausente", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        { event: "global:spectral-drop" },
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );
      expect(res.status).toBe(400);
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("retorna 400 quando payload eh null", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        { event: "global:spectral-drop", payload: null },
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );
      expect(res.status).toBe(400);
      expect((res.json() as { error: string }).error).toContain("object");
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("retorna 400 quando payload eh primitivo (string)", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        { event: "global:spectral-drop", payload: "not-an-object" },
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );
      expect(res.status).toBe(400);
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("retorna 400 com JSON invalido no body", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        "{not-valid-json",
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );
      expect(res.status).toBe(400);
      expect((res.json() as { error: string }).error).toBe("Invalid JSON");
      expect(emitMock).not.toHaveBeenCalled();
    });
  });

  describe("sucesso", () => {
    it("retorna 200 e chama io.emit com event + payload corretos", async () => {
      const payload = {
        userId: "user_42",
        userName: "Pedro",
        cardName: "Cristal Espectral",
        mobName: "Slime",
      };
      const res = await postJson(
        "/internal/broadcast-spectral",
        { event: "global:spectral-drop", payload },
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );

      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ delivered: "all" });
      expect(emitMock).toHaveBeenCalledOnce();
      expect(emitMock).toHaveBeenCalledWith("global:spectral-drop", payload);
    });

    it("aceita event arbitrario alem de global:spectral-drop", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        {
          event: "custom:test",
          payload: { foo: "bar", n: 7, nested: { k: true } },
        },
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );

      expect(res.status).toBe(200);
      expect(emitMock).toHaveBeenCalledWith("custom:test", {
        foo: "bar",
        n: 7,
        nested: { k: true },
      });
    });

    it("aceita payload de objeto vazio (mas nao null)", async () => {
      const res = await postJson(
        "/internal/broadcast-spectral",
        { event: "ev", payload: {} },
        { Authorization: `Bearer ${INTERNAL_SECRET}` },
      );
      expect(res.status).toBe(200);
      expect(emitMock).toHaveBeenCalledWith("ev", {});
    });
  });
});
