// Testes de integracao para GET /api/ranking/habits.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockHabitLogGroupBy = vi.fn();
const mockUserFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    habitLog: { groupBy: (...args: unknown[]) => mockHabitLogGroupBy(...args) },
    user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
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
  const url = `http://localhost:3000/api/ranking/habits${query}`;
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedVerifySession.mockResolvedValue({ userId: "user_a", email: "a@a.com" });
});

type HabitsEntryShape = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  house: "ARION" | "LYCUS" | "NOCTIS" | "NEREID" | null;
  level: number;
  habitCount: number;
};

describe("GET /api/ranking/habits", () => {
  it("retorna 200 com { entries: RankingHabitsEntry[] } no happy path", async () => {
    mockHabitLogGroupBy.mockResolvedValueOnce([
      { userId: "u1", _count: { _all: 30 } },
      { userId: "u2", _count: { _all: 20 } },
    ]);
    mockUserFindMany.mockResolvedValueOnce([
      {
        id: "u1",
        name: "Alice",
        avatarUrl: null,
        house: { name: "ARION" },
        character: { level: 12 },
      },
      {
        id: "u2",
        name: "Bob",
        avatarUrl: null,
        house: null,
        character: { level: 8 },
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { entries: HabitsEntryShape[] } };
    expect(body.data.entries).toHaveLength(2);
    expect(body.data.entries[0]).toEqual({
      rank: 1,
      userId: "u1",
      name: "Alice",
      avatarUrl: null,
      house: "ARION",
      level: 12,
      habitCount: 30,
    });
    expect(body.data.entries[1].rank).toBe(2);
    expect(body.data.entries[1].habitCount).toBe(20);
  });

  it("retorna 422 quando house invalida", async () => {
    const res = await GET(makeReq("?house=ATLANTIS"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_QUERY");
    expect(mockHabitLogGroupBy).not.toHaveBeenCalled();
  });

  it("retorna 422 quando limit=0", async () => {
    const res = await GET(makeReq("?limit=0"));
    expect(res.status).toBe(422);
  });

  it("retorna 401 quando verifySession lanca", async () => {
    mockedVerifySession.mockRejectedValueOnce(
      new AuthenticationError("Token de acesso nao fornecido", "MISSING_TOKEN"),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("MISSING_TOKEN");
    expect(mockHabitLogGroupBy).not.toHaveBeenCalled();
  });
});
