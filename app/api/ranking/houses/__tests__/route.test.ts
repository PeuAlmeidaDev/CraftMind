// Testes de integracao para GET /api/ranking/houses (Estandarte das Casas).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockHouseFindMany = vi.fn();
const mockBattleFindMany = vi.fn();
const mockTeamBattleParticipantFindMany = vi.fn();
const mockHabitLogFindMany = vi.fn();
const mockPveBattleFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    house: { findMany: (...args: unknown[]) => mockHouseFindMany(...args) },
    battle: { findMany: (...args: unknown[]) => mockBattleFindMany(...args) },
    teamBattleParticipant: {
      findMany: (...args: unknown[]) => mockTeamBattleParticipantFindMany(...args),
    },
    habitLog: { findMany: (...args: unknown[]) => mockHabitLogFindMany(...args) },
    pveBattle: { findMany: (...args: unknown[]) => mockPveBattleFindMany(...args) },
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
  const url = `http://localhost:3000/api/ranking/houses${query}`;
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedVerifySession.mockResolvedValue({ userId: "user_a", email: "a@a.com" });
});

const baseHouses = [
  { id: "h1", name: "ARION", animal: "Leao", _count: { users: 1 } },
  { id: "h2", name: "LYCUS", animal: "Lobo", _count: { users: 1 } },
  { id: "h3", name: "NOCTIS", animal: "Coruja", _count: { users: 1 } },
  { id: "h4", name: "NEREID", animal: "Sereia", _count: { users: 1 } },
];

type HouseStandardEntryShape = {
  rank: number;
  house: "ARION" | "LYCUS" | "NOCTIS" | "NEREID";
  animal: string;
  score: number;
  totalEvents: number;
  membersCount: number;
};

describe("GET /api/ranking/houses", () => {
  it("retorna 200 com sempre 4 entries (1 por casa) no happy path", async () => {
    mockHouseFindMany.mockResolvedValueOnce(baseHouses);
    mockBattleFindMany.mockResolvedValueOnce([
      { winner: { house: { name: "ARION" } } },
    ]);
    mockTeamBattleParticipantFindMany.mockResolvedValueOnce([]);
    mockHabitLogFindMany.mockResolvedValueOnce([]);
    mockPveBattleFindMany.mockResolvedValueOnce([]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { entries: HouseStandardEntryShape[] };
    };
    expect(body.data.entries).toHaveLength(4);
    const ranks = body.data.entries.map((e) => e.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4]);
    const arion = body.data.entries.find((e) => e.house === "ARION");
    // 1 vitoria 1v1 (peso 30) / 1 membro = 30
    expect(arion?.score).toBe(30);
    expect(arion?.rank).toBe(1);
  });

  it("retorna 422 quando season invalido", async () => {
    const res = await GET(makeReq("?season=foo"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_QUERY");
    expect(mockHouseFindMany).not.toHaveBeenCalled();
  });

  it("aceita season=monthly e season=weekly como validos", async () => {
    mockHouseFindMany.mockResolvedValue(baseHouses);
    mockBattleFindMany.mockResolvedValue([]);
    mockTeamBattleParticipantFindMany.mockResolvedValue([]);
    mockHabitLogFindMany.mockResolvedValue([]);
    mockPveBattleFindMany.mockResolvedValue([]);

    const r1 = await GET(makeReq("?season=monthly"));
    expect(r1.status).toBe(200);
    const r2 = await GET(makeReq("?season=weekly"));
    expect(r2.status).toBe(200);
  });

  it("retorna 401 quando verifySession lanca", async () => {
    mockedVerifySession.mockRejectedValueOnce(
      new AuthenticationError("Token de acesso nao fornecido", "MISSING_TOKEN"),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("MISSING_TOKEN");
    expect(mockHouseFindMany).not.toHaveBeenCalled();
  });
});
