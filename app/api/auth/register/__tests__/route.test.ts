import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — declarados antes do import da rota
// ---------------------------------------------------------------------------

const mockUserFindUnique = vi.fn();
const mockHabitFindMany = vi.fn();
const mockHouseFindUnique = vi.fn();
const mockSkillFindUnique = vi.fn();
const mockLoginLogCreate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    habit: { findMany: (...args: unknown[]) => mockHabitFindMany(...args) },
    house: { findUnique: (...args: unknown[]) => mockHouseFindUnique(...args) },
    skill: { findUnique: (...args: unknown[]) => mockSkillFindUnique(...args) },
    loginLog: { create: (...args: unknown[]) => mockLoginLogCreate(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(),
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

vi.mock("@/lib/helpers/determine-house", () => ({
  determineHouse: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (apos vi.mock)
// ---------------------------------------------------------------------------

import { POST } from "../route";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { createPersistedRefreshToken } from "@/lib/auth/refresh-token";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { determineHouse } from "@/lib/helpers/determine-house";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockedHashPassword = vi.mocked(hashPassword);
const mockedSignAccessToken = vi.mocked(signAccessToken);
const mockedCreatePersistedRefreshToken = vi.mocked(createPersistedRefreshToken);
const mockedAuthRateLimit = vi.mocked(authRateLimit);
const mockedGetClientIp = vi.mocked(getClientIp);
const mockedDetermineHouse = vi.mocked(determineHouse);

// CUIDs validos para os habitos (3 minimos exigidos pelo schema)
const HABIT_IDS = [
  "ckabc1234567890123456789a",
  "ckabc1234567890123456789b",
  "ckabc1234567890123456789c",
];

const VALID_BODY = {
  name: "TestPlayer",
  email: "test@example.com",
  password: "Abc12345",
  habitIds: HABIT_IDS,
};

const FAKE_HOUSE = {
  id: "house-1",
  name: "Noctis",
  animal: "Coruja",
  description: "Casa da noite",
};

const FAKE_HABITS = HABIT_IDS.map((id, i) => ({ id, name: `Habit-${i}` }));

const FAKE_CREATED_USER = {
  id: "user-new-1",
  name: "TestPlayer",
  email: "test@example.com",
  house: FAKE_HOUSE,
  habits: HABIT_IDS.map((id) => ({
    habit: { id, name: `H-${id}`, category: "MENTAL" },
  })),
};

const FAKE_CREATED_CHARACTER = {
  id: "char-new-1",
  physicalAtk: 10,
  physicalDef: 10,
  magicAtk: 10,
  magicDef: 10,
  hp: 100,
  speed: 10,
};

function makeRequest(body?: unknown, options?: { headers?: Record<string, string> }): NextRequest {
  const init: RequestInit & { headers?: Record<string, string> } = {
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost:3000/api/auth/register", init);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockUserFindUnique.mockReset();
  mockHabitFindMany.mockReset();
  mockHouseFindUnique.mockReset();
  mockSkillFindUnique.mockReset();
  mockLoginLogCreate.mockReset();
  mockTransaction.mockReset();

  // Defaults: rate limit passa, IP extraido
  mockedGetClientIp.mockReturnValue("127.0.0.1");
  mockedAuthRateLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });

  // Defaults para fluxo feliz
  mockUserFindUnique.mockResolvedValue(null); // nem nome nem email existem
  mockHabitFindMany.mockResolvedValue(FAKE_HABITS);
  mockHouseFindUnique.mockResolvedValue(FAKE_HOUSE);
  mockedDetermineHouse.mockReturnValue("NOCTIS");
  mockedHashPassword.mockResolvedValue("$2a$12$hashedpasswordhere");

  // Skills iniciais (Ataque Rapido + Bola de Fogo)
  mockSkillFindUnique
    .mockResolvedValueOnce({ id: "skill-fis" })
    .mockResolvedValueOnce({ id: "skill-mag" });

  // Transacao retorna user + character
  mockTransaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn !== "function") {
      throw new Error("transaction expects a function");
    }
    // Mock do tx — chama o callback com um proxy tx que tem os mesmos metodos.
    const tx = {
      user: { create: vi.fn().mockResolvedValue(FAKE_CREATED_USER) },
      character: { create: vi.fn().mockResolvedValue(FAKE_CREATED_CHARACTER) },
      skill: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: "skill-fis" })
          .mockResolvedValueOnce({ id: "skill-mag" }),
      },
      characterSkill: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    return fn(tx);
  });

  mockedSignAccessToken.mockResolvedValue("fake-access-token");
  mockedCreatePersistedRefreshToken.mockResolvedValue({
    token: "fake-refresh-token",
    family: "family-1",
  });

  // Default: loginLog grava com sucesso
  mockLoginLogCreate.mockResolvedValue({ id: "log-1" });
});

// ---------------------------------------------------------------------------
// Testes — focados em logLogin (anti multi-account)
// ---------------------------------------------------------------------------

describe("POST /api/auth/register — logLogin (anti multi-account)", () => {
  it("chama loginLog.create com userId, visitorId, ip e userAgent quando body inclui visitorId", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "user-agent": "TestBrowser/2.0",
      },
      body: JSON.stringify({ ...VALID_BODY, visitorId: "register-fingerprint-456" }),
    });

    const response = await POST(request);

    // Aguarda microtasks (fire-and-forget)
    await new Promise((r) => setImmediate(r));

    expect(response.status).toBe(201);
    expect(mockLoginLogCreate).toHaveBeenCalledOnce();
    const callArg = mockLoginLogCreate.mock.calls[0][0] as {
      data: { userId: string; visitorId: string; ip: string; userAgent: string };
    };
    expect(callArg.data.userId).toBe(FAKE_CREATED_USER.id);
    expect(callArg.data.visitorId).toBe("register-fingerprint-456");
    expect(callArg.data.ip).toBe("127.0.0.1");
    expect(callArg.data.userAgent).toBe("TestBrowser/2.0");
  });

  it("usa visitorId 'unknown' quando body nao inclui visitorId (Zod default)", async () => {
    const response = await POST(makeRequest(VALID_BODY));
    await new Promise((r) => setImmediate(r));

    expect(response.status).toBe(201);
    expect(mockLoginLogCreate).toHaveBeenCalledOnce();
    const callArg = mockLoginLogCreate.mock.calls[0][0] as {
      data: { visitorId: string };
    };
    expect(callArg.data.visitorId).toBe("unknown");
  });

  it("retorna 201 mesmo quando loginLog.create rejeita (fire-and-forget)", async () => {
    mockLoginLogCreate.mockRejectedValueOnce(new Error("DB write failed"));

    const response = await POST(makeRequest(VALID_BODY));
    await new Promise((r) => setImmediate(r));

    expect(response.status).toBe(201);
  });

  it("nao chama loginLog quando o usuario ja existe (registro falha)", async () => {
    // Simula que email ou nome ja existe
    mockUserFindUnique.mockResolvedValueOnce({ id: "existing-user" });

    const response = await POST(makeRequest(VALID_BODY));
    await new Promise((r) => setImmediate(r));

    expect(response.status).toBe(422);
    expect(mockLoginLogCreate).not.toHaveBeenCalled();
  });
});
