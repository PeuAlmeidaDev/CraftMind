import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do prisma ANTES de importar o modulo sob teste.
const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pvpStats: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

import { getPvpRanking } from "@/lib/ranking/pvp";

type PvpFindManyArgs = {
  where?: {
    mode?: "SOLO_1V1" | "TEAM_2V2";
    character?: {
      user?: {
        houseId?: { not: null };
        house?: { name: "ARION" | "LYCUS" | "NOCTIS" | "NEREID" };
      };
    };
  };
  orderBy?: ReadonlyArray<Record<string, "asc" | "desc">>;
  take?: number;
};

beforeEach(() => {
  findManyMock.mockReset();
});

describe("getPvpRanking", () => {
  it("retorna array vazio quando nao ha stats", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const result = await getPvpRanking("SOLO_1V1", "GLOBAL", 50);
    expect(result).toEqual([]);
  });

  it("preserva ordem do prisma (rankingPoints desc, wins desc) e atribui rank 1-based", async () => {
    findManyMock.mockResolvedValueOnce([
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
            avatarUrl: "https://cdn/a.png",
            house: { name: "ARION" },
          },
        },
      },
      {
        rankingPoints: 1200,
        wins: 20,
        losses: 10,
        draws: 1,
        character: {
          level: 18,
          user: {
            id: "u2",
            name: "Bob",
            avatarUrl: null,
            house: { name: "LYCUS" },
          },
        },
      },
      {
        rankingPoints: 1200,
        wins: 15,
        losses: 7,
        draws: 0,
        character: {
          level: 15,
          user: {
            id: "u3",
            name: "Carol",
            avatarUrl: null,
            house: null,
          },
        },
      },
    ]);

    const result = await getPvpRanking("SOLO_1V1", "GLOBAL", 50);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      rank: 1,
      userId: "u1",
      name: "Alice",
      house: "ARION",
      level: 20,
      rankingPoints: 1500,
      wins: 30,
      losses: 5,
      draws: 0,
    });
    expect(result[1]).toMatchObject({
      rank: 2,
      userId: "u2",
      house: "LYCUS",
      rankingPoints: 1200,
      wins: 20,
    });
    expect(result[2]).toMatchObject({
      rank: 3,
      userId: "u3",
      house: null,
    });
  });

  it("envia orderBy [rankingPoints desc, wins desc] ao prisma", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getPvpRanking("SOLO_1V1", "GLOBAL", 50);

    const args = findManyMock.mock.calls[0]?.[0] as PvpFindManyArgs | undefined;
    expect(args?.orderBy).toEqual([
      { rankingPoints: "desc" },
      { wins: "desc" },
    ]);
  });

  it("nao aplica filtro de casa quando house=GLOBAL", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getPvpRanking("SOLO_1V1", "GLOBAL", 50);

    const args = findManyMock.mock.calls[0]?.[0] as PvpFindManyArgs | undefined;
    // userWhere e undefined no GLOBAL
    expect(args?.where?.character?.user).toBeUndefined();
  });

  it("aplica filtro de casa quando house != GLOBAL", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getPvpRanking("SOLO_1V1", "ARION", 50);

    const args = findManyMock.mock.calls[0]?.[0] as PvpFindManyArgs | undefined;
    expect(args?.where?.character?.user).toEqual({
      houseId: { not: null },
      house: { name: "ARION" },
    });
  });

  it("envia o mode correto ao prisma (SOLO_1V1 vs TEAM_2V2)", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getPvpRanking("SOLO_1V1", "GLOBAL", 10);
    let args = findManyMock.mock.calls[0]?.[0] as PvpFindManyArgs | undefined;
    expect(args?.where?.mode).toBe("SOLO_1V1");

    findManyMock.mockReset();
    findManyMock.mockResolvedValueOnce([]);
    await getPvpRanking("TEAM_2V2", "GLOBAL", 10);
    args = findManyMock.mock.calls[0]?.[0] as PvpFindManyArgs | undefined;
    expect(args?.where?.mode).toBe("TEAM_2V2");
  });

  it("respeita limit (passa como take ao prisma)", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getPvpRanking("SOLO_1V1", "GLOBAL", 25);

    const args = findManyMock.mock.calls[0]?.[0] as PvpFindManyArgs | undefined;
    expect(args?.take).toBe(25);
  });

  it("trata user.house=null mapeando house para null no resultado", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        rankingPoints: 100,
        wins: 1,
        losses: 0,
        draws: 0,
        character: {
          level: 1,
          user: {
            id: "u-orphan",
            name: "Sem Casa",
            avatarUrl: null,
            house: null,
          },
        },
      },
    ]);

    const result = await getPvpRanking("SOLO_1V1", "GLOBAL", 50);
    expect(result[0].house).toBeNull();
  });
});
