// lib/cards/__tests__/load-equipped-edge.test.ts
//
// Edge cases COMPLEMENTARES de loadEquippedCardsAndApply (nao duplicar
// load-equipped.test.ts existente). Cobre:
//
//   11. spectralSkill (relation Skill) carregada normalmente mesmo se o
//       MobSkill correspondente do mob de origem tiver sido removido pelo
//       admin entre a hora da escolha (PUT /spectral-skill) e a batalha.
//       O load-equipped NAO revalida MobSkill — confia que a Skill carregada
//       eh suficiente. (Apenas se a Skill for NULL e que faz skip + warn.)

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

describe("loadEquippedCardsAndApply — edge cases adicionais", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("retorna spectralSkill mesmo se a Skill nao mais pertence ao MobSkill do mob de origem (relation ja foi escolhida valida)", async () => {
    // Cenario: o admin removeu a relacao MobSkill apos a escolha do jogador.
    // load-equipped NAO checa MobSkill — apenas usa o Skill carregado via
    // relation `spectralSkill`. Esse comportamento eh por design: a validacao
    // contra MobSkill so acontece no momento do PUT (escolha).
    const cards: FakeUserCard[] = [
      {
        id: "uc-orphan-mobskill",
        userId: "user-1",
        cardId: "card-x",
        equipped: true,
        slotIndex: 0,
        xp: 0,
        level: 1,
        purity: 100,
        spectralSkillId: "skill-z",
        card: { id: "card-x", effects: [] },
        // Skill ainda existe no banco (carregada via relation), mas o admin
        // removeu o MobSkill. A engine nao revalida.
        spectralSkill: makeFakeSkill("skill-z"),
      },
    ];
    const prisma = makePrismaMock(cards);
    const result = await loadEquippedCardsAndApply(
      prisma as never,
      "user-1",
      baseStats,
    );

    expect(result.spectralSkill).toBeDefined();
    expect(result.spectralSkill?.skill.id).toBe("skill-z");
    expect(result.spectralSkill?.sourceUserCardId).toBe("uc-orphan-mobskill");
  });

  it("retorna spectralSkill com mastery e effects intactos no Skill construido", async () => {
    // Garante que TODOS os campos da Skill sao mapeados (effects, mastery,
    // accuracy, damageType, etc.)
    const fakeSkill = {
      id: "skill-full",
      name: "Skill Completa",
      description: "Com mastery e effects",
      tier: 3,
      cooldown: 2,
      target: "ALL_ENEMIES",
      damageType: "MAGICAL",
      basePower: 75,
      hits: 2,
      accuracy: 90,
      effects: [
        {
          type: "BUFF",
          target: "SELF",
          stat: "magicAtk",
          value: 1,
          duration: 2,
        },
      ],
      mastery: { maxLevel: 5, bonusPerLevel: 2 },
    };

    const cards: FakeUserCard[] = [
      {
        id: "uc-full",
        userId: "user-1",
        cardId: "card-y",
        equipped: true,
        slotIndex: 0,
        xp: 0,
        level: 1,
        purity: 100,
        spectralSkillId: "skill-full",
        card: { id: "card-y", effects: [] },
        spectralSkill: fakeSkill,
      },
    ];
    const prisma = makePrismaMock(cards);
    const result = await loadEquippedCardsAndApply(
      prisma as never,
      "user-1",
      baseStats,
    );

    expect(result.spectralSkill).toBeDefined();
    const sk = result.spectralSkill?.skill;
    expect(sk?.id).toBe("skill-full");
    expect(sk?.tier).toBe(3);
    expect(sk?.cooldown).toBe(2);
    expect(sk?.target).toBe("ALL_ENEMIES");
    expect(sk?.damageType).toBe("MAGICAL");
    expect(sk?.basePower).toBe(75);
    expect(sk?.hits).toBe(2);
    expect(sk?.accuracy).toBe(90);
    expect(sk?.effects).toEqual(fakeSkill.effects);
    expect(sk?.mastery).toEqual(fakeSkill.mastery);
  });
});
