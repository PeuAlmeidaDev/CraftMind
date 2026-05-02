import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do prisma ANTES de importar o modulo sob teste.
const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    character: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

import { getLevelRanking } from "@/lib/ranking/level";

type CharacterFindManyArgs = {
  where?: {
    user?: {
      houseId?: { not: null };
      house?: { name: "ARION" | "LYCUS" | "NOCTIS" | "NEREID" };
    };
  };
  orderBy?: ReadonlyArray<Record<string, "asc" | "desc">>;
  take?: number;
};

beforeEach(() => {
  findManyMock.mockReset();
});

describe("getLevelRanking", () => {
  it("retorna array vazio quando nao ha personagens", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const result = await getLevelRanking("GLOBAL", 50);
    expect(result).toEqual([]);
  });

  it("preserva ordem do prisma (level desc, currentExp desc) e atribui rank 1-based", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        level: 30,
        currentExp: 5000,
        user: {
          id: "u1",
          name: "Alice",
          avatarUrl: "https://cdn/a.png",
          house: { name: "ARION" },
        },
      },
      {
        level: 25,
        currentExp: 3000,
        user: {
          id: "u2",
          name: "Bob",
          avatarUrl: null,
          house: { name: "LYCUS" },
        },
      },
      {
        level: 25,
        currentExp: 1500,
        user: {
          id: "u3",
          name: "Carol",
          avatarUrl: null,
          house: null,
        },
      },
    ]);

    const result = await getLevelRanking("GLOBAL", 50);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      rank: 1,
      userId: "u1",
      name: "Alice",
      house: "ARION",
      level: 30,
      currentExp: 5000,
    });
    expect(result[1]).toMatchObject({
      rank: 2,
      userId: "u2",
      level: 25,
      currentExp: 3000,
    });
    expect(result[2]).toMatchObject({
      rank: 3,
      userId: "u3",
      house: null,
    });
  });

  it("envia orderBy [level desc, currentExp desc] ao prisma", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getLevelRanking("GLOBAL", 50);

    const args = findManyMock.mock.calls[0]?.[0] as CharacterFindManyArgs | undefined;
    expect(args?.orderBy).toEqual([
      { level: "desc" },
      { currentExp: "desc" },
    ]);
  });

  it("nao aplica filtro de casa quando house=GLOBAL", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getLevelRanking("GLOBAL", 50);

    const args = findManyMock.mock.calls[0]?.[0] as CharacterFindManyArgs | undefined;
    expect(args?.where?.user).toBeUndefined();
  });

  it("aplica filtro de casa quando house != GLOBAL", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getLevelRanking("NOCTIS", 50);

    const args = findManyMock.mock.calls[0]?.[0] as CharacterFindManyArgs | undefined;
    expect(args?.where?.user).toEqual({
      houseId: { not: null },
      house: { name: "NOCTIS" },
    });
  });

  it("respeita limit (passa como take ao prisma)", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await getLevelRanking("GLOBAL", 10);

    const args = findManyMock.mock.calls[0]?.[0] as CharacterFindManyArgs | undefined;
    expect(args?.take).toBe(10);
  });

  it("trata user.house=null mapeando house para null no resultado", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        level: 5,
        currentExp: 10,
        user: {
          id: "u-orphan",
          name: "Sem Casa",
          avatarUrl: null,
          house: null,
        },
      },
    ]);

    const result = await getLevelRanking("GLOBAL", 50);
    expect(result[0].house).toBeNull();
  });
});
