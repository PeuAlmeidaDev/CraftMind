// Testes de integracao para GET /api/ranking/level.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCharacterFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    character: { findMany: (...args: unknown[]) => mockCharacterFindMany(...args) },
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
  const url = `http://localhost:3000/api/ranking/level${query}`;
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedVerifySession.mockResolvedValue({ userId: "user_a", email: "a@a.com" });
});

type LevelEntryShape = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  house: "ARION" | "LYCUS" | "NOCTIS" | "NEREID" | null;
  level: number;
  currentExp: number;
};

describe("GET /api/ranking/level", () => {
  it("retorna 200 com { entries: RankingLevelEntry[] } no happy path", async () => {
    mockCharacterFindMany.mockResolvedValueOnce([
      {
        level: 30,
        currentExp: 5000,
        user: {
          id: "u1",
          name: "Alice",
          avatarUrl: "https://cdn/a.png",
          house: { name: "NOCTIS" },
        },
      },
      {
        level: 22,
        currentExp: 1000,
        user: {
          id: "u2",
          name: "Bob",
          avatarUrl: null,
          house: null,
        },
      },
    ]);

    const res = await GET(makeReq("?house=GLOBAL&limit=50"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { entries: LevelEntryShape[] } };
    expect(body.data.entries).toHaveLength(2);
    expect(body.data.entries[0]).toEqual({
      rank: 1,
      userId: "u1",
      name: "Alice",
      avatarUrl: "https://cdn/a.png",
      house: "NOCTIS",
      level: 30,
      currentExp: 5000,
    });
    expect(body.data.entries[1].house).toBeNull();
  });

  it("retorna 422 quando house desconhecida", async () => {
    const res = await GET(makeReq("?house=DRAGON"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_QUERY");
    expect(mockCharacterFindMany).not.toHaveBeenCalled();
  });

  it("retorna 422 quando limit nao numerico", async () => {
    const res = await GET(makeReq("?limit=abc"));
    expect(res.status).toBe(422);
  });

  it("retorna 401 quando verifySession lanca", async () => {
    mockedVerifySession.mockRejectedValueOnce(
      new AuthenticationError("Token invalido", "INVALID_TOKEN"),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_TOKEN");
    expect(mockCharacterFindMany).not.toHaveBeenCalled();
  });
});
