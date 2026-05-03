// app/api/cards/[id]/absorb/__tests__/route.test.ts
//
// Cobre POST /api/cards/[id]/absorb:
// - 401 sem auth
// - 422 body invalido (vazio, dup, alvo nas fontes)
// - 404 alvo inexistente
// - 403 alvo de outro user
// - 422 source inexistente / de outro user
// - 422 source com cardId diferente do alvo
// - 422 source equipado
// - Happy path: 1 source COMUM => +50 XP, sem level up
// - Happy path: 5 sources LENDARIO => +4000 XP somado, level cap em 5
// - Happy path com leveledUp via raridade alta

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks de prisma e auth
// ---------------------------------------------------------------------------

const mockUserCardFindUnique = vi.fn();
const mockUserCardFindMany = vi.fn();
const mockUserCardUpdate = vi.fn();
const mockUserCardDeleteMany = vi.fn();
const mockTx = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCard: {
      findUnique: (...args: unknown[]) => mockUserCardFindUnique(...args),
      findMany: (...args: unknown[]) => mockUserCardFindMany(...args),
      update: (...args: unknown[]) => mockUserCardUpdate(...args),
      deleteMany: (...args: unknown[]) => mockUserCardDeleteMany(...args),
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

import { POST } from "../route";
import {
  verifySession,
  AuthenticationError,
} from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// IDs precisam passar no z.string().cuid() do schema. Cuids reais comecam com
// "c" + 24 chars [a-z0-9]. Geramos algumas constantes deterministicas.
const TARGET_ID = "c000000000000000000000001";
const SRC1_ID = "c000000000000000000000002";
const SRC2_ID = "c000000000000000000000003";
const SRC3_ID = "c000000000000000000000004";
const SRC4_ID = "c000000000000000000000005";
const SRC5_ID = "c000000000000000000000006";

function makeReq(targetId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/cards/${targetId}/absorb`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const SAMPLE_TARGET = {
  id: TARGET_ID,
  userId: "user_a",
  cardId: "card_slime",
  xp: 0,
  level: 1,
  card: { rarity: "COMUM" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  // tx executa o callback delegando aos mocks ja configurados.
  mockTx.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      userCard: {
        update: mockUserCardUpdate,
        deleteMany: mockUserCardDeleteMany,
      },
    };
    return fn(tx);
  });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("POST /api/cards/[id]/absorb — auth", () => {
  it("retorna 401 sem auth", async () => {
    mockedVerifySession.mockRejectedValue(
      new AuthenticationError("Token invalido", "INVALID_TOKEN"),
    );

    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [SRC1_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Validacoes de body
// ---------------------------------------------------------------------------

describe("POST /api/cards/[id]/absorb — body validation", () => {
  beforeEach(() => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
  });

  it("retorna 422 quando sourceUserCardIds vazio", async () => {
    const res = await POST(makeReq(TARGET_ID, { sourceUserCardIds: [] }), {
      params: Promise.resolve({ id: TARGET_ID }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("retorna 422 quando body sem sourceUserCardIds", async () => {
    const res = await POST(makeReq(TARGET_ID, {}), {
      params: Promise.resolve({ id: TARGET_ID }),
    });
    expect(res.status).toBe(422);
  });

  it("retorna 422 quando IDs duplicados no payload", async () => {
    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [SRC1_ID, SRC1_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("DUPLICATE_SOURCE_IDS");
  });

  it("retorna 422 quando alvo esta entre as fontes", async () => {
    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [TARGET_ID, SRC1_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("TARGET_IN_SOURCES");
  });
});

// ---------------------------------------------------------------------------
// Validacoes contra o banco
// ---------------------------------------------------------------------------

describe("POST /api/cards/[id]/absorb — db checks", () => {
  beforeEach(() => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
  });

  it("retorna 404 quando alvo nao existe", async () => {
    mockUserCardFindUnique.mockResolvedValue(null);

    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [SRC1_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("TARGET_NOT_FOUND");
  });

  it("retorna 403 quando alvo pertence a outro user", async () => {
    mockUserCardFindUnique.mockResolvedValue({
      ...SAMPLE_TARGET,
      userId: "user_OUTRO",
    });

    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [SRC1_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("retorna 422 quando algum source nao existe / nao pertence ao user", async () => {
    mockUserCardFindUnique.mockResolvedValue(SAMPLE_TARGET);
    // Pediu 2 sources, banco retorna so 1 (o outro nao pertence ao user ou nao existe).
    mockUserCardFindMany.mockResolvedValue([
      {
        id: SRC1_ID,
        cardId: "card_slime",
        equipped: false,
        card: { rarity: "COMUM" },
      },
    ]);

    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [SRC1_ID, SRC2_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("SOURCE_INVALID");
  });

  it("retorna 422 quando source tem cardId diferente do alvo", async () => {
    mockUserCardFindUnique.mockResolvedValue(SAMPLE_TARGET);
    mockUserCardFindMany.mockResolvedValue([
      {
        id: SRC1_ID,
        cardId: "card_OUTRO",
        equipped: false,
        card: { rarity: "COMUM" },
      },
    ]);

    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [SRC1_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("SOURCE_DIFFERENT_CARD");
  });

  it("retorna 422 quando source esta equipado", async () => {
    mockUserCardFindUnique.mockResolvedValue(SAMPLE_TARGET);
    mockUserCardFindMany.mockResolvedValue([
      {
        id: SRC1_ID,
        cardId: "card_slime",
        equipped: true,
        card: { rarity: "COMUM" },
      },
    ]);

    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [SRC1_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("SOURCE_EQUIPPED");
  });
});

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe("POST /api/cards/[id]/absorb — happy paths", () => {
  beforeEach(() => {
    mockedVerifySession.mockResolvedValue({ userId: "user_a" });
  });

  it("1 source COMUM transfere 50 XP sem level up", async () => {
    mockUserCardFindUnique.mockResolvedValue({
      ...SAMPLE_TARGET,
      xp: 0,
      level: 1,
    });
    mockUserCardFindMany.mockResolvedValue([
      {
        id: SRC1_ID,
        cardId: "card_slime",
        equipped: false,
        card: { rarity: "COMUM" },
      },
    ]);
    mockUserCardUpdate.mockResolvedValue({});
    mockUserCardDeleteMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [SRC1_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        targetUserCardId: string;
        xpGained: number;
        newXp: number;
        newLevel: number;
        leveledUp: boolean;
        sacrificed: number;
      };
    };
    expect(body.data).toMatchObject({
      targetUserCardId: TARGET_ID,
      xpGained: 50, // XP_PER_DUPLICATE_BY_RARITY.COMUM
      newXp: 50,
      newLevel: 1,
      leveledUp: false,
      sacrificed: 1,
    });

    expect(mockTx).toHaveBeenCalledOnce();
    expect(mockUserCardUpdate).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { xp: 50, level: 1 },
    });
    expect(mockUserCardDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: [SRC1_ID] }, userId: "user_a" },
    });
  });

  it("5 sources LENDARIO transferem 4000 XP somados (level cap 5)", async () => {
    // Alvo LENDARIO Lv1, xp=0. Cada source LENDARIO da 800 XP. 5*800 = 4000
    // → ja passa 1000 (threshold Lv5) → newLevel=5, leveledUp=true.
    mockUserCardFindUnique.mockResolvedValue({
      ...SAMPLE_TARGET,
      cardId: "card_dragon",
      card: { rarity: "LENDARIO" },
    });
    const sources = [SRC1_ID, SRC2_ID, SRC3_ID, SRC4_ID, SRC5_ID].map((id) => ({
      id,
      cardId: "card_dragon",
      equipped: false,
      card: { rarity: "LENDARIO" },
    }));
    mockUserCardFindMany.mockResolvedValue(sources);
    mockUserCardUpdate.mockResolvedValue({});
    mockUserCardDeleteMany.mockResolvedValue({ count: 5 });

    const res = await POST(
      makeReq(TARGET_ID, {
        sourceUserCardIds: [SRC1_ID, SRC2_ID, SRC3_ID, SRC4_ID, SRC5_ID],
      }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        xpGained: number;
        newXp: number;
        newLevel: number;
        leveledUp: boolean;
        sacrificed: number;
      };
    };
    expect(body.data.xpGained).toBe(4000);
    expect(body.data.newXp).toBe(4000);
    expect(body.data.newLevel).toBe(5);
    expect(body.data.leveledUp).toBe(true);
    expect(body.data.sacrificed).toBe(5);

    expect(mockUserCardUpdate).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { xp: 4000, level: 5 },
    });
    expect(mockUserCardDeleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: [SRC1_ID, SRC2_ID, SRC3_ID, SRC4_ID, SRC5_ID] },
        userId: "user_a",
      },
    });
  });

  it("EPICO Lv1 com 1 source EPICO sobe Lv1 -> Lv3 (400 XP cumulativo passa threshold 250)", async () => {
    // Alvo EPICO xp=0/Lv1. Source EPICO da 400 XP. 400 >= 250 (Lv3) e < 500 (Lv4).
    mockUserCardFindUnique.mockResolvedValue({
      ...SAMPLE_TARGET,
      cardId: "card_epic",
      card: { rarity: "EPICO" },
    });
    mockUserCardFindMany.mockResolvedValue([
      {
        id: SRC1_ID,
        cardId: "card_epic",
        equipped: false,
        card: { rarity: "EPICO" },
      },
    ]);
    mockUserCardUpdate.mockResolvedValue({});
    mockUserCardDeleteMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      makeReq(TARGET_ID, { sourceUserCardIds: [SRC1_ID] }),
      { params: Promise.resolve({ id: TARGET_ID }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { xpGained: number; newXp: number; newLevel: number; leveledUp: boolean };
    };
    expect(body.data.xpGained).toBe(400);
    expect(body.data.newXp).toBe(400);
    expect(body.data.newLevel).toBe(3);
    expect(body.data.leveledUp).toBe(true);
  });
});
