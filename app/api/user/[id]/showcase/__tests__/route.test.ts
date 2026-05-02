// app/api/user/[id]/showcase/__tests__/route.test.ts
//
// Cobertura GET /api/user/[id]/showcase:
// - 401 sem auth.
// - 422 com ID nao-cuid.
// - 200 vazio quando usuario nao tem vitrine (sem 404).
// - 200 com cards ordenados conforme userCardIds.
// - 200 com cards orfaos (deletados) filtrados silenciosamente.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockShowcaseFindUnique = vi.fn();
const mockUserCardFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userShowcase: {
      findUnique: (...args: unknown[]) => mockShowcaseFindUnique(...args),
    },
    userCard: {
      findMany: (...args: unknown[]) => mockUserCardFindMany(...args),
    },
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

import { GET } from "../route";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

const VALID_CUID = "cltest1234567890abcdef0123";

function makeReq(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/user/${id}/showcase`, {
    method: "GET",
  });
}

const SAMPLE_USERCARD = {
  id: "uc_1",
  equipped: false,
  slotIndex: null,
  xp: 100,
  level: 2,
  purity: 100,
  card: {
    id: "card_1",
    name: "Cristal do Slime",
    flavorText: "Memoria liquida.",
    rarity: "COMUM",
    effects: [],
    cardArtUrl: null,
    cardArtUrlSpectral: null,
    mob: { id: "mob_1", name: "Slime", tier: 1, imageUrl: null },
  },
};

describe("GET /api/user/[id]/showcase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 sem auth", async () => {
    mockedVerifySession.mockRejectedValue(
      new AuthenticationError("Token invalido", "INVALID_TOKEN"),
    );

    const res = await GET(makeReq(VALID_CUID), {
      params: Promise.resolve({ id: VALID_CUID }),
    });
    expect(res.status).toBe(401);
  });

  it("retorna 422 com ID nao-cuid", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "viewer" });

    const res = await GET(makeReq("not-a-cuid"), {
      params: Promise.resolve({ id: "not-a-cuid" }),
    });
    expect(res.status).toBe(422);
  });

  it("retorna 200 vazio quando usuario nao tem vitrine", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "viewer" });
    mockShowcaseFindUnique.mockResolvedValue(null);

    const res = await GET(makeReq(VALID_CUID), {
      params: Promise.resolve({ id: VALID_CUID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { userCardIds: string[]; cards: unknown[] };
    };
    expect(body.data.userCardIds).toEqual([]);
    expect(body.data.cards).toEqual([]);
    expect(mockUserCardFindMany).not.toHaveBeenCalled();
  });

  it("retorna 200 vazio quando vitrine existe mas userCardIds vazio", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "viewer" });
    mockShowcaseFindUnique.mockResolvedValue({ userCardIds: [] });

    const res = await GET(makeReq(VALID_CUID), {
      params: Promise.resolve({ id: VALID_CUID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { userCardIds: string[]; cards: unknown[] };
    };
    expect(body.data.userCardIds).toEqual([]);
    expect(body.data.cards).toEqual([]);
  });

  it("retorna 200 com cards ordenados conforme userCardIds", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "viewer" });
    mockShowcaseFindUnique.mockResolvedValue({
      userCardIds: ["uc_2", "uc_1"],
    });
    mockUserCardFindMany.mockResolvedValue([
      { ...SAMPLE_USERCARD, id: "uc_1" },
      { ...SAMPLE_USERCARD, id: "uc_2" },
    ]);

    const res = await GET(makeReq(VALID_CUID), {
      params: Promise.resolve({ id: VALID_CUID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { userCardIds: string[]; cards: Array<{ id: string }> };
    };
    expect(body.data.userCardIds).toEqual(["uc_2", "uc_1"]);
    // Ordem preservada do userCardIds.
    expect(body.data.cards.map((c) => c.id)).toEqual(["uc_2", "uc_1"]);
  });

  it("filtra silenciosamente IDs orfaos (UserCard deletada)", async () => {
    mockedVerifySession.mockResolvedValue({ userId: "viewer" });
    mockShowcaseFindUnique.mockResolvedValue({
      userCardIds: ["uc_1", "uc_DELETED", "uc_2"],
    });
    // Apenas uc_1 e uc_2 existem.
    mockUserCardFindMany.mockResolvedValue([
      { ...SAMPLE_USERCARD, id: "uc_1" },
      { ...SAMPLE_USERCARD, id: "uc_2" },
    ]);

    const res = await GET(makeReq(VALID_CUID), {
      params: Promise.resolve({ id: VALID_CUID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { userCardIds: string[]; cards: Array<{ id: string }> };
    };
    // userCardIds permanece com o ID orfao (snapshot do que o dono salvou).
    expect(body.data.userCardIds).toEqual(["uc_1", "uc_DELETED", "uc_2"]);
    // cards omite os orfaos.
    expect(body.data.cards.map((c) => c.id)).toEqual(["uc_1", "uc_2"]);
  });
});
