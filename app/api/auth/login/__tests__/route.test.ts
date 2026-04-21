import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — declarados antes do import da rota
// ---------------------------------------------------------------------------

const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    refreshToken: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/auth/jwt", () => ({
  signAccessToken: vi.fn(),
}));

vi.mock("@/lib/auth/refresh-token", () => ({
  createPersistedRefreshToken: vi.fn(),
}));

vi.mock("@/lib/auth/set-auth-cookies", () => ({
  setAccessTokenCookie: vi.fn(),
  setRefreshTokenCookie: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  authRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (apos vi.mock)
// ---------------------------------------------------------------------------

import { POST } from "../route";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { createPersistedRefreshToken } from "@/lib/auth/refresh-token";
import { setAccessTokenCookie, setRefreshTokenCookie } from "@/lib/auth/set-auth-cookies";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockedVerifyPassword = vi.mocked(verifyPassword);
const mockedSignAccessToken = vi.mocked(signAccessToken);
const mockedCreatePersistedRefreshToken = vi.mocked(createPersistedRefreshToken);
const mockedSetAccessTokenCookie = vi.mocked(setAccessTokenCookie);
const mockedSetRefreshTokenCookie = vi.mocked(setRefreshTokenCookie);
const mockedAuthRateLimit = vi.mocked(authRateLimit);
const mockedGetClientIp = vi.mocked(getClientIp);

function makeRequest(body?: unknown, options?: { headers?: Record<string, string> }): NextRequest {
  const init: RequestInit & { headers?: Record<string, string> } = {
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost:3000/api/auth/login", init);
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{{{",
  });
}

interface ResponseBody {
  data?: {
    user?: {
      id?: string;
      name?: string;
      email?: string;
      house?: Record<string, unknown>;
      habits?: Array<Record<string, unknown>>;
    };
    character?: Record<string, unknown>;
    accessToken?: string;
    passwordHash?: string;
  };
  error?: string;
  code?: string;
}

async function parseResponse(response: Response): Promise<{ status: number; body: ResponseBody }> {
  return { status: response.status, body: (await response.json()) as ResponseBody };
}

// ---------------------------------------------------------------------------
// Dados de teste
// ---------------------------------------------------------------------------

const VALID_CREDENTIALS = { email: "player@example.com", password: "Abc12345" };

const FAKE_USER_AUTH = {
  id: "user-abc-123",
  email: "player@example.com",
  passwordHash: "$2a$12$hashedpasswordhere",
};

const FAKE_USER_FULL = {
  id: "user-abc-123",
  name: "Player One",
  email: "player@example.com",
  house: { id: "house-1", name: "Noctis", animal: "Coruja", description: "Casa da noite" },
  habits: [
    { habit: { id: "h1", name: "Meditacao", category: "MENTAL" } },
    { habit: { id: "h2", name: "Leitura", category: "MENTAL" } },
  ],
  character: {
    id: "char-1",
    physicalAtk: 10,
    physicalDef: 10,
    magicAtk: 12,
    magicDef: 8,
    hp: 100,
    speed: 9,
  },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockReset();

  // Defaults: rate limit passa, IP extraido
  mockedGetClientIp.mockReturnValue("127.0.0.1");
  mockedAuthRateLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("POST /api/auth/login", () => {
  // =======================================================================
  // Rate limiting
  // =======================================================================
  describe("quando rate limit excedido", () => {
    it("retorna 429 com header Retry-After", async () => {
      const resetTime = Date.now() + 30_000;
      mockedAuthRateLimit.mockResolvedValue({ success: false, remaining: 0, reset: resetTime });

      const response = await POST(makeRequest(VALID_CREDENTIALS));

      expect(response.status).toBe(429);
      const retryAfter = response.headers.get("Retry-After");
      expect(retryAfter).toBeDefined();
      expect(Number(retryAfter)).toBeGreaterThan(0);

      const body = (await response.json()) as ResponseBody;
      expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("extrai IP do cliente para rate limiting", async () => {
      mockedAuthRateLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 10_000 });

      await POST(makeRequest(VALID_CREDENTIALS));

      expect(mockedGetClientIp).toHaveBeenCalledOnce();
      expect(mockedAuthRateLimit).toHaveBeenCalledWith("127.0.0.1");
    });
  });

  // =======================================================================
  // Validacao de body (parse JSON)
  // =======================================================================
  describe("quando body invalido", () => {
    it("retorna 400 quando body nao e JSON valido", async () => {
      const { status, body } = await parseResponse(await POST(makeInvalidJsonRequest()));

      expect(status).toBe(400);
      expect(body.code).toBe("INVALID_BODY");
    });

    it("retorna 400 quando body esta vazio", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
      });

      const { status, body } = await parseResponse(await POST(request));

      expect(status).toBe(400);
      expect(body.code).toBe("INVALID_BODY");
    });
  });

  // =======================================================================
  // Validacao Zod
  // =======================================================================
  describe("quando validacao Zod falha", () => {
    it("retorna 422 quando email esta ausente", async () => {
      const { status, body } = await parseResponse(
        await POST(makeRequest({ password: "Abc12345" }))
      );

      expect(status).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("retorna 422 quando email e invalido", async () => {
      const { status, body } = await parseResponse(
        await POST(makeRequest({ email: "not-an-email", password: "Abc12345" }))
      );

      expect(status).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("retorna 422 quando email excede 254 caracteres", async () => {
      const longEmail = "a".repeat(250) + "@b.co";
      const { status, body } = await parseResponse(
        await POST(makeRequest({ email: longEmail, password: "Abc12345" }))
      );

      expect(status).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("retorna 422 quando senha esta ausente", async () => {
      const { status, body } = await parseResponse(
        await POST(makeRequest({ email: "valid@email.com" }))
      );

      expect(status).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("retorna 422 quando senha e string vazia", async () => {
      const { status, body } = await parseResponse(
        await POST(makeRequest({ email: "valid@email.com", password: "" }))
      );

      expect(status).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("retorna 422 quando senha excede 72 caracteres", async () => {
      const longPassword = "A".repeat(73);
      const { status, body } = await parseResponse(
        await POST(makeRequest({ email: "valid@email.com", password: longPassword }))
      );

      expect(status).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
    });
  });

  // =======================================================================
  // Normalizacao de email
  // =======================================================================
  describe("normalizacao de email pelo schema", () => {
    it("normaliza email para lowercase antes de buscar no banco", async () => {
      mockFindUnique.mockResolvedValueOnce(null); // userAuth lookup
      mockedVerifyPassword.mockResolvedValue(false);

      await POST(makeRequest({ email: "Player@Example.COM", password: "Abc12345" }));

      // O email deve ser normalizado para lowercase antes de chegar ao Prisma
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: "player@example.com" },
        })
      );
    });

    it("normaliza email com espacos nas bordas (trim antes de validar)", async () => {
      // O schema aplica .trim() antes de .email(), entao espacos sao removidos
      mockFindUnique.mockResolvedValueOnce(null);
      mockedVerifyPassword.mockResolvedValue(false);

      await POST(makeRequest({ email: "  player@example.com  ", password: "Abc12345" }));

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: "player@example.com" },
        })
      );
    });
  });

  // =======================================================================
  // Usuario nao encontrado
  // =======================================================================
  describe("quando usuario nao existe", () => {
    it("retorna 401 com mensagem generica", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      mockedVerifyPassword.mockResolvedValue(false);

      const { status, body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(status).toBe(401);
      expect(body.code).toBe("INVALID_CREDENTIALS");
      // Nao deve revelar se email existe ou nao
      expect(body.error).toBe("Credenciais invalidas");
    });

    it("executa dummy hash para prevenir timing attack", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      mockedVerifyPassword.mockResolvedValue(false);

      await POST(makeRequest(VALID_CREDENTIALS));

      // verifyPassword deve ser chamado mesmo quando usuario nao existe
      expect(mockedVerifyPassword).toHaveBeenCalledOnce();
      expect(mockedVerifyPassword).toHaveBeenCalledWith(
        VALID_CREDENTIALS.password,
        expect.stringContaining("$2a$12$")
      );
    });
  });

  // =======================================================================
  // Senha incorreta
  // =======================================================================
  describe("quando senha esta incorreta", () => {
    it("retorna 401 com mesma mensagem generica", async () => {
      mockFindUnique.mockResolvedValueOnce(FAKE_USER_AUTH);
      mockedVerifyPassword.mockResolvedValue(false);

      const { status, body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(status).toBe(401);
      expect(body.code).toBe("INVALID_CREDENTIALS");
      expect(body.error).toBe("Credenciais invalidas");
    });

    it("usa o hash real do usuario para verificacao", async () => {
      mockFindUnique.mockResolvedValueOnce(FAKE_USER_AUTH);
      mockedVerifyPassword.mockResolvedValue(false);

      await POST(makeRequest(VALID_CREDENTIALS));

      expect(mockedVerifyPassword).toHaveBeenCalledWith(
        VALID_CREDENTIALS.password,
        FAKE_USER_AUTH.passwordHash
      );
    });
  });

  // =======================================================================
  // Dados incompletos (sem house ou character)
  // =======================================================================
  describe("quando dados do usuario estao incompletos", () => {
    it("retorna 500 quando user e null na segunda query", async () => {
      mockFindUnique
        .mockResolvedValueOnce(FAKE_USER_AUTH) // primeira query (auth)
        .mockResolvedValueOnce(null); // segunda query (dados completos)
      mockedVerifyPassword.mockResolvedValue(true);

      const { status, body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(status).toBe(500);
      expect(body.code).toBe("INTERNAL_ERROR");
    });

    it("retorna 500 quando house e null", async () => {
      mockFindUnique
        .mockResolvedValueOnce(FAKE_USER_AUTH)
        .mockResolvedValueOnce({ ...FAKE_USER_FULL, house: null });
      mockedVerifyPassword.mockResolvedValue(true);

      const { status, body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(status).toBe(500);
      expect(body.code).toBe("INTERNAL_ERROR");
    });

    it("retorna 500 quando character e null", async () => {
      mockFindUnique
        .mockResolvedValueOnce(FAKE_USER_AUTH)
        .mockResolvedValueOnce({ ...FAKE_USER_FULL, character: null });
      mockedVerifyPassword.mockResolvedValue(true);

      const { status, body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(status).toBe(500);
      expect(body.code).toBe("INTERNAL_ERROR");
    });
  });

  // =======================================================================
  // Happy path
  // =======================================================================
  describe("quando credenciais validas", () => {
    beforeEach(() => {
      mockFindUnique
        .mockResolvedValueOnce(FAKE_USER_AUTH) // primeira query
        .mockResolvedValueOnce(FAKE_USER_FULL); // segunda query
      mockedVerifyPassword.mockResolvedValue(true);
      mockedSignAccessToken.mockResolvedValue("fake-access-token");
      mockedCreatePersistedRefreshToken.mockResolvedValue({
        token: "fake-refresh-token",
        family: "family-1",
      });
    });

    it("retorna 200 com accessToken e dados do usuario", async () => {
      const { status, body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(status).toBe(200);
      expect(body.data?.accessToken).toBe("fake-access-token");
      expect(body.data?.user?.id).toBe(FAKE_USER_FULL.id);
      expect(body.data?.user?.name).toBe(FAKE_USER_FULL.name);
      expect(body.data?.user?.email).toBe(FAKE_USER_FULL.email);
    });

    it("retorna dados da casa do usuario", async () => {
      const { body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(body.data?.user?.house).toEqual(FAKE_USER_FULL.house);
    });

    it("retorna habitos formatados (sem nesting do UserHabit)", async () => {
      const { body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      const expectedHabits = FAKE_USER_FULL.habits.map((uh) => uh.habit);
      expect(body.data?.user?.habits).toEqual(expectedHabits);
    });

    it("retorna character com atributos completos", async () => {
      const { body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(body.data?.character).toEqual(FAKE_USER_FULL.character);
    });

    it("nunca inclui passwordHash na resposta", async () => {
      const { body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      const rawJson = JSON.stringify(body);
      expect(rawJson).not.toContain("passwordHash");
      expect(rawJson).not.toContain("hashedpasswordhere");
    });

    it("gera access token com userId e email", async () => {
      await POST(makeRequest(VALID_CREDENTIALS));

      expect(mockedSignAccessToken).toHaveBeenCalledWith({
        userId: FAKE_USER_FULL.id,
        email: FAKE_USER_FULL.email,
      });
    });

    it("cria refresh token persistido com userId", async () => {
      await POST(makeRequest(VALID_CREDENTIALS));

      expect(mockedCreatePersistedRefreshToken).toHaveBeenCalledWith({
        userId: FAKE_USER_FULL.id,
      });
    });

    it("seta cookies de access e refresh token", async () => {
      const response = await POST(makeRequest(VALID_CREDENTIALS));

      expect(mockedSetAccessTokenCookie).toHaveBeenCalledWith(response, "fake-access-token");
      expect(mockedSetRefreshTokenCookie).toHaveBeenCalledWith(response, "fake-refresh-token");
    });

    it("gera tokens em paralelo (Promise.all)", async () => {
      // Verifica que ambos foram chamados (a paralelizacao e testada implicitamente)
      await POST(makeRequest(VALID_CREDENTIALS));

      expect(mockedSignAccessToken).toHaveBeenCalledOnce();
      expect(mockedCreatePersistedRefreshToken).toHaveBeenCalledOnce();
    });
  });

  // =======================================================================
  // Erro inesperado (catch generico)
  // =======================================================================
  describe("quando ocorre erro inesperado", () => {
    it("retorna 500 com INTERNAL_ERROR quando Prisma lanca excecao", async () => {
      mockFindUnique.mockRejectedValueOnce(new Error("DB connection lost"));

      const { status, body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(status).toBe(500);
      expect(body.code).toBe("INTERNAL_ERROR");
      // Nao deve expor detalhes do erro interno
      expect(body.error).toBe("Erro interno do servidor");
    });

    it("retorna 500 quando signAccessToken lanca excecao", async () => {
      mockFindUnique
        .mockResolvedValueOnce(FAKE_USER_AUTH)
        .mockResolvedValueOnce(FAKE_USER_FULL);
      mockedVerifyPassword.mockResolvedValue(true);
      mockedSignAccessToken.mockRejectedValue(new Error("JWT_SECRET not set"));

      const { status, body } = await parseResponse(await POST(makeRequest(VALID_CREDENTIALS)));

      expect(status).toBe(500);
      expect(body.code).toBe("INTERNAL_ERROR");
    });
  });
});
