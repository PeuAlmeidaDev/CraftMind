import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do prisma ANTES de importar o modulo sob teste.
const groupByMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    habitLog: {
      groupBy: (...args: unknown[]) => groupByMock(...args),
    },
    user: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

import { getHabitsRanking } from "@/lib/ranking/habits";

beforeEach(() => {
  groupByMock.mockReset();
  findManyMock.mockReset();
});

describe("getHabitsRanking", () => {
  it("retorna array vazio quando nao ha logs", async () => {
    groupByMock.mockResolvedValueOnce([]);

    const result = await getHabitsRanking("GLOBAL", 50);

    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("preserva ordem do groupBy (count desc) e atribui ranks corretamente", async () => {
    groupByMock.mockResolvedValueOnce([
      { userId: "u1", _count: { _all: 30 } },
      { userId: "u2", _count: { _all: 20 } },
      { userId: "u3", _count: { _all: 10 } },
    ]);

    findManyMock.mockResolvedValueOnce([
      // findMany pode retornar em qualquer ordem; o codigo deve reordenar.
      {
        id: "u3",
        name: "Charlie",
        avatarUrl: null,
        house: { name: "ARION" },
        character: { level: 5 },
      },
      {
        id: "u1",
        name: "Alice",
        avatarUrl: "https://cdn.example/a.png",
        house: { name: "LYCUS" },
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

    const result = await getHabitsRanking("GLOBAL", 50);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      rank: 1,
      userId: "u1",
      name: "Alice",
      habitCount: 30,
      level: 12,
      house: "LYCUS",
    });
    expect(result[1]).toMatchObject({
      rank: 2,
      userId: "u2",
      habitCount: 20,
      house: null,
    });
    expect(result[2]).toMatchObject({
      rank: 3,
      userId: "u3",
      habitCount: 10,
      house: "ARION",
    });
  });

  it("usa level=1 como fallback quando o personagem nao existe", async () => {
    groupByMock.mockResolvedValueOnce([
      { userId: "u1", _count: { _all: 5 } },
    ]);
    findManyMock.mockResolvedValueOnce([
      {
        id: "u1",
        name: "Newbie",
        avatarUrl: null,
        house: null,
        character: null,
      },
    ]);

    const result = await getHabitsRanking("GLOBAL", 50);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe(1);
  });

  it("filtra users que sumiram no findMany (filtro de casa)", async () => {
    groupByMock.mockResolvedValueOnce([
      { userId: "u1", _count: { _all: 30 } },
      { userId: "u2", _count: { _all: 20 } },
      { userId: "u3", _count: { _all: 10 } },
    ]);

    // Apenas u1 e u3 tem house=ARION; u2 some.
    findManyMock.mockResolvedValueOnce([
      {
        id: "u1",
        name: "Alice",
        avatarUrl: null,
        house: { name: "ARION" },
        character: { level: 5 },
      },
      {
        id: "u3",
        name: "Charlie",
        avatarUrl: null,
        house: { name: "ARION" },
        character: { level: 3 },
      },
    ]);

    const result = await getHabitsRanking("ARION", 50);

    expect(result).toHaveLength(2);
    // Ranks 1 e 2 (nao 1 e 3) — sao reatribuidos apos o filtro.
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
    expect(result.map((r) => r.userId)).toEqual(["u1", "u3"]);
  });

  it("respeita limit (corta apos o limite)", async () => {
    groupByMock.mockResolvedValueOnce([
      { userId: "u1", _count: { _all: 30 } },
      { userId: "u2", _count: { _all: 20 } },
      { userId: "u3", _count: { _all: 10 } },
      { userId: "u4", _count: { _all: 5 } },
    ]);
    findManyMock.mockResolvedValueOnce([
      { id: "u1", name: "A", avatarUrl: null, house: null, character: { level: 1 } },
      { id: "u2", name: "B", avatarUrl: null, house: null, character: { level: 1 } },
      { id: "u3", name: "C", avatarUrl: null, house: null, character: { level: 1 } },
      { id: "u4", name: "D", avatarUrl: null, house: null, character: { level: 1 } },
    ]);

    const result = await getHabitsRanking("GLOBAL", 2);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.userId)).toEqual(["u1", "u2"]);
  });
});
