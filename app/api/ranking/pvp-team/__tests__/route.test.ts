// Testes de integracao para GET /api/ranking/pvp-team.

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

vi.mock("next/cache", () => ({
  unstable_cache: <TArgs extends readonly unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
  ) => fn,
}));

import { GET } from "../route";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";

const mockedVerifySession = vi.mocked(verifySession);

function makeReq(query = ""): NextRequest {
  const url = `http://localhost:3000/api/ranking/pvp-team${query}`;
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
  rankingPoints: number;
  wins: number;
  losses: number;
  draws: number;
};

describe("GET /api/ranking/pvp-team", () => {
  it("retorna 200 com { entries: RankingPvpEntry[] } no happy path", async () => {
    mockPvpStatsFindMany.mockResolvedValueOnce([
      {
        rankingPoints: 1300,
        wins: 22,
        losses: 8,
        draws: 1,
        character: {
          level: 18,
          user: {
            id: "u1",
            name: "Alice",
            avatarUrl: null,
            house: { name: "LYCUS" },
          },
        },
      },
      {
        rankingPoints: 1200,
        wins: 18,
        losses: 6,
        draws: 0,
        character: {
          level: 17,
          user: {
            id: "u2",
            name: "Bob",
            avatarUrl: null,
            house: null,
          },
        },
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { entries: PvpEntryShape[] } };
    expect(body.data.entries).toHaveLength(2);
    expect(body.data.entries[0].rank).toBe(1);
    expect(body.data.entries[1].rank).toBe(2);
    expect(body.data.entries[0].rankingPoints).toBe(1300);
  });

  it("usa TEAM_2V2 como mode no helper", async () => {
    mockPvpStatsFindMany.mockResolvedValueOnce([]);
    await GET(makeReq());

    const args = mockPvpStatsFindMany.mock.calls[0]?.[0] as
      | { where?: { mode?: string } }
      | undefined;
    expect(args?.where?.mode).toBe("TEAM_2V2");
  });

  it("retorna 422 quando season=foo (param desconhecido nao quebra mas house=foo sim)", async () => {
    const res = await GET(makeReq("?house=foo"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_QUERY");
    expect(mockPvpStatsFindMany).not.toHaveBeenCalled();
  });

  it("retorna 401 quando verifySession lanca AuthenticationError", async () => {
    mockedVerifySession.mockRejectedValueOnce(
      new AuthenticationError("Token expirado", "TOKEN_EXPIRED"),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("TOKEN_EXPIRED");
  });
});
