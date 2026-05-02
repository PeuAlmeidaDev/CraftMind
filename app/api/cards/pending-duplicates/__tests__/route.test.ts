// app/api/cards/pending-duplicates/__tests__/route.test.ts
//
// Cobertura:
// - GET feliz (200) lista pendencias do user autenticado.
// - GET sem auth (401).
// - POST REPLACE feliz (200) — zera xp/level, atualiza purity, apaga pendencia.
// - POST CONVERT feliz (200) — aplica XP via applyXpGain, mantem purity, apaga pendencia.
// - POST com decision invalida (422).
// - POST com pendencia inexistente (404).
// - POST com pendencia de outro user (403).
// - POST com userCard ausente (410, cleanup silencioso).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks de prisma e auth (declarados antes dos imports da rota)
// ---------------------------------------------------------------------------

const mockPendingFindMany = vi.fn();
const mockPendingCount = vi.fn();
const mockPendingFindUnique = vi.fn();
const mockPendingDelete = vi.fn();
const mockUserCardUpdate = vi.fn();
const mockTx = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pendingCardDuplicate: {
      findMany: (...args: unknown[]) => mockPendingFindMany(...args),
      count: (...args: unknown[]) => mockPendingCount(...args),
      findUnique: (...args: unknown[]) => mockPendingFindUnique(...args),
      delete: (...args: unknown[]) => mockPendingDelete(...args),
    },
    userCard: {
      update: (...args: unknown[]) => mockUserCardUpdate(...args),
    },
    $transaction: (fn: unknown) => mockTx(fn),
  },
}));

vi.mock("@/lib/auth/verify-session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/verify-session")>(
    "@/lib/auth/verify-session",
  );
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports apos mocks
// ---------------------------------------------------------------------------

import { GET } from "../route";
import { POST } from "../[id]/resolve/route";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

function makeGetReq(qs = ""): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/cards/pending-duplicates${qs}`,
    { method: "GET" },
  );
}

function makePostReq(id: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/cards/pending-duplicates/${id}/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const NOW = new Date("2026-05-02T12:00:00.000Z");

const EXAMPLE_PENDING = {
  id: "pend_1",
  userId: "user_a",
  userCardId: "uc_1",
  newPurity: 88,
  createdAt: NOW,
  userCard: {
    id: "uc_1",
    xp: 50,
    level: 1,
    purity: 60,
    card: {
      id: "card_1",
      name: "Cristal do Slime",
      flavorText: "Memoria liquida.",
      rarity: "COMUM" as const,
      mob: {
        id: "mob_1",
        name: "Slime",
        tier: 1,
        imageUrl: null,
      },
    },
  },
};

// ---------------------------------------------------------------------------
// GET /api/cards/pending-duplicates
// ---------------------------------------------------------------------------

describe("GET /api/cards/pending-duplicates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 sem auth", async () => {
    mockedVerifySession.mockRejectedValue(
      new AuthenticationError("Token invalido", "INVALID_TOKEN"),
    );

    const res = await GET(makeGetReq());
    expect(res.status).toBe(401);
  });

  it("retorna 200 com lista de pendencias do user", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockPendingFindMany.mockResolvedValue([EXAMPLE_PENDING]);
    mockPendingCount.mockResolvedValue(1);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        pendingDuplicates: Array<{
          id: string;
          newPurity: number;
          userCard: { id: string; purity: number };
        }>;
        pagination: { total: number; limit: number; offset: number };
      };
    };
    expect(body.data.pendingDuplicates).toHaveLength(1);
    expect(body.data.pendingDuplicates[0]).toMatchObject({
      id: "pend_1",
      newPurity: 88,
      userCard: { id: "uc_1", purity: 60 },
    });
    expect(body.data.pagination).toEqual({ total: 1, limit: 50, offset: 0 });

    // Filtra por userId.
    const findArg = mockPendingFindMany.mock.calls[0][0];
    expect(findArg.where).toEqual({ userId: "user_a" });
  });

  it("respeita limit e offset da query string", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockPendingFindMany.mockResolvedValue([]);
    mockPendingCount.mockResolvedValue(0);

    const res = await GET(makeGetReq("?limit=10&offset=20"));
    expect(res.status).toBe(200);
    const findArg = mockPendingFindMany.mock.calls[0][0];
    expect(findArg.take).toBe(10);
    expect(findArg.skip).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// POST /api/cards/pending-duplicates/[id]/resolve
// ---------------------------------------------------------------------------

describe("POST /api/cards/pending-duplicates/[id]/resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: tx executa o callback passando um cliente que delega aos mocks.
    mockTx.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        userCard: { update: mockUserCardUpdate },
        pendingCardDuplicate: { delete: mockPendingDelete },
      };
      return fn(tx);
    });
  });

  it("retorna 401 sem auth", async () => {
    mockedVerifySession.mockRejectedValue(
      new AuthenticationError("Token invalido", "INVALID_TOKEN"),
    );

    const res = await POST(makePostReq("pend_1", { decision: "REPLACE" }), {
      params: Promise.resolve({ id: "pend_1" }),
    });
    expect(res.status).toBe(401);
  });

  it("retorna 422 com decision invalida", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });

    const res = await POST(makePostReq("pend_1", { decision: "DELETE" }), {
      params: Promise.resolve({ id: "pend_1" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("retorna 422 com body sem decision", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });

    const res = await POST(makePostReq("pend_1", {}), {
      params: Promise.resolve({ id: "pend_1" }),
    });
    expect(res.status).toBe(422);
  });

  it("retorna 404 quando pendencia nao existe", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockPendingFindUnique.mockResolvedValue(null);

    const res = await POST(makePostReq("pend_x", { decision: "REPLACE" }), {
      params: Promise.resolve({ id: "pend_x" }),
    });
    expect(res.status).toBe(404);
  });

  it("retorna 403 quando pendencia pertence a outro user", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockPendingFindUnique.mockResolvedValue({
      ...EXAMPLE_PENDING,
      userId: "user_OUTRO",
    });

    const res = await POST(makePostReq("pend_1", { decision: "REPLACE" }), {
      params: Promise.resolve({ id: "pend_1" }),
    });
    expect(res.status).toBe(403);
  });

  it("retorna 410 quando userCard alvo nao existe (orfa)", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockPendingFindUnique.mockResolvedValue({
      ...EXAMPLE_PENDING,
      userCard: null,
    });
    mockPendingDelete.mockResolvedValue({});

    const res = await POST(makePostReq("pend_1", { decision: "REPLACE" }), {
      params: Promise.resolve({ id: "pend_1" }),
    });
    expect(res.status).toBe(410);
  });

  it("REPLACE: zera xp/level, atualiza purity e apaga pendencia (atomico)", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    mockPendingFindUnique.mockResolvedValue(EXAMPLE_PENDING);
    mockUserCardUpdate.mockResolvedValue({
      id: "uc_1",
      xp: 0,
      level: 1,
      purity: 88,
    });
    mockPendingDelete.mockResolvedValue({});

    const res = await POST(makePostReq("pend_1", { decision: "REPLACE" }), {
      params: Promise.resolve({ id: "pend_1" }),
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: {
        decision: "REPLACE" | "CONVERT";
        userCard: { xp: number; level: number; purity: number };
      };
    };
    expect(body.data.decision).toBe("REPLACE");
    expect(body.data.userCard).toEqual({
      id: "uc_1",
      xp: 0,
      level: 1,
      purity: 88,
    });

    expect(mockTx).toHaveBeenCalledOnce();
    expect(mockUserCardUpdate).toHaveBeenCalledWith({
      where: { id: "uc_1" },
      data: { xp: 0, level: 1, purity: 88 },
      select: { id: true, xp: true, level: true, purity: true },
    });
    expect(mockPendingDelete).toHaveBeenCalledWith({ where: { id: "pend_1" } });
  });

  it("CONVERT: aplica XP normal mantendo purity, apaga pendencia", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
    // userCard.xp=50, level=1, purity=60. Carta COMUM (50 XP por dup) -> newXp=100, newLevel=2.
    mockPendingFindUnique.mockResolvedValue(EXAMPLE_PENDING);
    mockUserCardUpdate.mockResolvedValue({
      id: "uc_1",
      xp: 100,
      level: 2,
      purity: 60,
    });
    mockPendingDelete.mockResolvedValue({});

    const res = await POST(makePostReq("pend_1", { decision: "CONVERT" }), {
      params: Promise.resolve({ id: "pend_1" }),
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: {
        decision: "REPLACE" | "CONVERT";
        userCard: { xp: number; level: number; purity: number };
        xpGained: number;
        leveledUp: boolean;
        newLevel: number;
      };
    };
    expect(body.data.decision).toBe("CONVERT");
    expect(body.data.xpGained).toBe(50); // XP_PER_DUPLICATE_BY_RARITY.COMUM
    expect(body.data.userCard.purity).toBe(60); // NAO mudou
    expect(body.data.leveledUp).toBe(true);
    expect(body.data.newLevel).toBe(2);

    expect(mockTx).toHaveBeenCalledOnce();
    expect(mockUserCardUpdate).toHaveBeenCalledWith({
      where: { id: "uc_1" },
      data: { xp: 100, level: 2 },
      select: { id: true, xp: true, level: true, purity: true },
    });
    expect(mockPendingDelete).toHaveBeenCalledWith({ where: { id: "pend_1" } });
  });
});
