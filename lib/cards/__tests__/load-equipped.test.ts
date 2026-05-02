// lib/cards/__tests__/load-equipped.test.ts
//
// Cobre `loadEquippedCardsAndApply` na parte do retorno `spectralSkill`:
//   - Sem cartas equipadas -> spectralSkill undefined
//   - 1 espectral equipada com skillId valido -> retorna corretamente
//   - 1 espectral equipada SEM spectralSkillId -> undefined
//   - 3 espectrais equipadas em slots 2, 0, 1 -> retorna a do slot 0
//   - spectralSkillId aponta pra Skill inexistente (spectralSkill null) -> warn + undefined
//
// Mocka o PrismaClient com objeto plano. Ignora os tests ja cobertos de
// applyCardEffects (cobertos em effects.test.ts).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadEquippedCardsAndApply } from "../load-equipped";
import type { BaseStats } from "@/lib/battle/types";

const baseStats: BaseStats = {
  physicalAtk: 10,
  physicalDef: 10,
  magicAtk: 10,
  magicDef: 10,
  hp: 100,
  speed: 10,
};

type FakeUserCard = {
  id: string;
  userId: string;
  cardId: string;
  equipped: boolean;
  slotIndex: number | null;
  xp: number;
  level: number;
  purity: number;
  spectralSkillId: string | null;
  card: {
    id: string;
    effects: unknown;
  };
  spectralSkill: null | {
    id: string;
    name: string;
    description: string;
    tier: number;
    cooldown: number;
    target: string;
    damageType: string;
    basePower: number;
    hits: number;
    accuracy: number;
    effects: unknown;
    mastery: unknown;
  };
};

function makeFakeSkill(id: string) {
  return {
    id,
    name: `Skill ${id}`,
    description: "skill de teste",
    tier: 1,
    cooldown: 0,
    target: "SINGLE_ENEMY",
    damageType: "PHYSICAL",
    basePower: 40,
    hits: 1,
    accuracy: 100,
    effects: [],
    mastery: {},
  };
}

function makePrismaMock(cards: FakeUserCard[]) {
  return {
    userCard: {
      findMany: vi.fn(async () => cards),
    },
  };
}

describe("loadEquippedCardsAndApply — spectralSkill", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("retorna spectralSkill undefined quando nenhuma carta equipada", async () => {
    const prisma = makePrismaMock([]);
    const result = await loadEquippedCardsAndApply(
      prisma as never,
      "user-1",
      baseStats,
    );
    expect(result.baseStats).toEqual(baseStats);
    expect(result.spectralSkill).toBeUndefined();
  });

  it("retorna spectralSkill undefined quando ha carta equipada sem purity 100", async () => {
    const cards: FakeUserCard[] = [
      {
        id: "uc-a",
        userId: "user-1",
        cardId: "card-a",
        equipped: true,
        slotIndex: 0,
        xp: 0,
        level: 1,
        purity: 50,
        spectralSkillId: null,
        card: { id: "card-a", effects: [] },
        spectralSkill: null,
      },
    ];
    const prisma = makePrismaMock(cards);
    const result = await loadEquippedCardsAndApply(
      prisma as never,
      "user-1",
      baseStats,
    );
    expect(result.spectralSkill).toBeUndefined();
  });

  it("retorna spectralSkill undefined quando carta Espectral nao tem spectralSkillId", async () => {
    const cards: FakeUserCard[] = [
      {
        id: "uc-spectral",
        userId: "user-1",
        cardId: "card-x",
        equipped: true,
        slotIndex: 0,
        xp: 0,
        level: 1,
        purity: 100,
        spectralSkillId: null,
        card: { id: "card-x", effects: [] },
        spectralSkill: null,
      },
    ];
    const prisma = makePrismaMock(cards);
    const result = await loadEquippedCardsAndApply(
      prisma as never,
      "user-1",
      baseStats,
    );
    expect(result.spectralSkill).toBeUndefined();
  });

  it("retorna spectralSkill quando ha 1 espectral equipada com skill carregada", async () => {
    const cards: FakeUserCard[] = [
      {
        id: "uc-spectral",
        userId: "user-1",
        cardId: "card-x",
        equipped: true,
        slotIndex: 1,
        xp: 0,
        level: 1,
        purity: 100,
        spectralSkillId: "skill-1",
        card: { id: "card-x", effects: [] },
        spectralSkill: makeFakeSkill("skill-1"),
      },
    ];
    const prisma = makePrismaMock(cards);
    const result = await loadEquippedCardsAndApply(
      prisma as never,
      "user-1",
      baseStats,
    );
    expect(result.spectralSkill).toBeDefined();
    expect(result.spectralSkill?.skill.id).toBe("skill-1");
    expect(result.spectralSkill?.sourceUserCardId).toBe("uc-spectral");
  });

  it("entre 3 espectrais equipadas em slots 2, 0, 1 retorna a do slot 0", async () => {
    const cards: FakeUserCard[] = [
      {
        id: "uc-slot-2",
        userId: "user-1",
        cardId: "card-2",
        equipped: true,
        slotIndex: 2,
        xp: 0,
        level: 1,
        purity: 100,
        spectralSkillId: "skill-2",
        card: { id: "card-2", effects: [] },
        spectralSkill: makeFakeSkill("skill-2"),
      },
      {
        id: "uc-slot-0",
        userId: "user-1",
        cardId: "card-0",
        equipped: true,
        slotIndex: 0,
        xp: 0,
        level: 1,
        purity: 100,
        spectralSkillId: "skill-0",
        card: { id: "card-0", effects: [] },
        spectralSkill: makeFakeSkill("skill-0"),
      },
      {
        id: "uc-slot-1",
        userId: "user-1",
        cardId: "card-1",
        equipped: true,
        slotIndex: 1,
        xp: 0,
        level: 1,
        purity: 100,
        spectralSkillId: "skill-1",
        card: { id: "card-1", effects: [] },
        spectralSkill: makeFakeSkill("skill-1"),
      },
    ];
    const prisma = makePrismaMock(cards);
    const result = await loadEquippedCardsAndApply(
      prisma as never,
      "user-1",
      baseStats,
    );
    expect(result.spectralSkill?.skill.id).toBe("skill-0");
    expect(result.spectralSkill?.sourceUserCardId).toBe("uc-slot-0");
  });

  it("warn + spectralSkill undefined quando spectralSkillId aponta pra Skill inexistente", async () => {
    const warnSpy = vi.spyOn(console, "warn");
    const cards: FakeUserCard[] = [
      {
        id: "uc-orphan",
        userId: "user-1",
        cardId: "card-x",
        equipped: true,
        slotIndex: 0,
        xp: 0,
        level: 1,
        purity: 100,
        spectralSkillId: "skill-deleted",
        card: { id: "card-x", effects: [] },
        spectralSkill: null,
      },
    ];
    const prisma = makePrismaMock(cards);
    const result = await loadEquippedCardsAndApply(
      prisma as never,
      "user-1",
      baseStats,
    );
    expect(result.spectralSkill).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    const args = warnSpy.mock.calls[0]?.[0];
    expect(typeof args).toBe("string");
    expect(args).toContain("uc-orphan");
  });

  it("retorna baseStats inalterado quando nao ha cartas (regressao)", async () => {
    const prisma = makePrismaMock([]);
    const result = await loadEquippedCardsAndApply(
      prisma as never,
      "user-1",
      baseStats,
    );
    expect(result.baseStats).toEqual(baseStats);
  });
});
