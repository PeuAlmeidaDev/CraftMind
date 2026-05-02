// Testes de integracao para GET /api/ranking/pvp-1v1.
// Mock de prisma + verifySession + next/cache (passthrough).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockPvpStatsFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pvpStats: { findMany: (...args: unknown[]) => mockPvpStatsFindMany(...args) },
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

// Cache passthrough — invoca a funcao diretamente, sem cache.
vi.mock("next/cache", () => ({
  unstable_cache: <TArgs extends readonly unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
  ) => fn,
}));

import { GET } from "../route";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

function makeReq(query = ""): NextRequest {
  const url = `http://localhost:3000/api/ranking/pvp-1v1${query}`;
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedVerifySession.mockResolvedValue({ userId: "user_a", email: "a@a.com" });
});

type PvpEntryShape = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  house: "ARION" | "LYCUS" | "NOCTIS" | "NEREID" | null;
  level: number;
  rankingPoints: number;
  wins: number;
  losses: number;
  draws: number;
};

describe("GET /api/ranking/pvp-1v1", () => {
  it("retorna 200 com { entries: RankingPvpEntry[] } no happy path", async () => {
    mockPvpStatsFindMany.mockResolvedValueOnce([
      {
        rankingPoints: 1500,
        wins: 30,
        losses: 5,
        draws: 0,
        character: {
          level: 20,
          user: {
            id: "u1",
            name: "Alice",
            avatarUrl: null,
            house: { name: "ARION" },
          },
        },
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { entries: PvpEntryShape[] } };
    expect(body.data.entries).toHaveLength(1);
    expect(body.data.entries[0]).toEqual({
      rank: 1,
      userId: "u1",
      name: "Alice",
      avatarUrl: null,
      house: "ARION",
      level: 20,
      rankingPoints: 1500,
      wins: 30,
      losses: 5,
      draws: 0,
    });
  });

  it("usa SOLO_1V1 como mode no helper", async () => {
    mockPvpStatsFindMany.mockResolvedValueOnce([]);
    await GET(makeReq("?house=ARION&limit=10"));

    const args = mockPvpStatsFindMany.mock.calls[0]?.[0] as
      | { where?: { mode?: string } }
      | undefined;
    expect(args?.where?.mode).toBe("SOLO_1V1");
  });

  it("retorna 422 quando query param invalido (house=INVALID)", async () => {
    const res = await GET(makeReq("?house=INVALID"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("INVALID_QUERY");
    expect(mockPvpStatsFindMany).not.toHaveBeenCalled();
  });

  it("retorna 422 quando limit fora do range (limit=200)", async () => {
    const res = await GET(makeReq("?limit=200"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_QUERY");
  });

  it("retorna 422 quando limit negativo (limit=-1)", async () => {
    const res = await GET(makeReq("?limit=-1"));
    expect(res.status).toBe(422);
  });

  it("retorna 401 quando token ausente (verifySession lanca)", async () => {
    mockedVerifySession.mockRejectedValueOnce(
      new AuthenticationError("Token de acesso nao fornecido", "MISSING_TOKEN"),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("MISSING_TOKEN");
    expect(mockPvpStatsFindMany).not.toHaveBeenCalled();
  });
});
