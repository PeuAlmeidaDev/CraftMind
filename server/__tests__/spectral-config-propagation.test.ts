// server/__tests__/spectral-config-propagation.test.ts
//
// Cobre a propagacao do `spectralSkill` retornado por `loadEquippedCardsAndApply`
// ate `BattlePlayerConfig` consumido pelos `init*Battle()` da engine. Os
// matchmaking handlers (matchmaking.ts, boss-matchmaking.ts, coop-pve-matchmaking.ts,
// pvp-team-matchmaking.ts e os invite handlers) sao thin wrappers em volta dessa
// pipeline; testando a pipeline diretamente cobrimos o contrato de propagacao
// sem booting de servidor real.
//
// Caso 1: jogador SEM cristal Espectral equipado -> spectralSkill === undefined
// Caso 2: jogador COM cristal Espectral equipado -> config.spectralSkill propagado
//          ate state.players[].equippedSkills com fromSpectralCard: true (5o slot)

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadEquippedCardsAndApply } from "@/lib/cards/load-equipped";
import { initBattle } from "@/lib/battle/init";
import type { BaseStats, EquippedSkill } from "@/lib/battle/types";

const baseStats: BaseStats = {
  physicalAtk: 10,
  physicalDef: 10,
  magicAtk: 10,
  magicDef: 10,
  hp: 100,
  speed: 10,
};

function makeBasicSkillEquipped(id: string): EquippedSkill {
  return {
    skillId: id,
    slotIndex: 0,
    skill: {
      id,
      name: id,
      description: "skill base",
      tier: 1,
      cooldown: 0,
      target: "SINGLE_ENEMY",
      damageType: "PHYSICAL",
      basePower: 30,
      hits: 1,
      accuracy: 100,
      effects: [],
      mastery: {},
    },
  };
}

function makePrismaMockNoCards() {
  return {
    userCard: {
      findMany: vi.fn(async () => []),
    },
  };
}

function makePrismaMockWithSpectral(skillId: string) {
  return {
    userCard: {
      findMany: vi.fn(async () => [
        {
          id: "uc-spectral-1",
          userId: "user-x",
          cardId: "card-1",
          equipped: true,
          slotIndex: 0,
          xp: 0,
          level: 1,
          purity: 100,
          spectralSkillId: skillId,
          card: { id: "card-1", effects: [] },
          spectralSkill: {
            id: skillId,
            name: "Skill Espectral",
            description: "skill espectral de teste",
            tier: 2,
            cooldown: 1,
            target: "SINGLE_ENEMY",
            damageType: "MAGICAL",
            basePower: 60,
            hits: 1,
            accuracy: 95,
            effects: [],
            mastery: {},
          },
        },
      ]),
    },
  };
}

describe("Spectral config propagation (matchmaking pipeline)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("jogador SEM cristal Espectral -> config.spectralSkill undefined; state com 4 skills", async () => {
    const prisma = makePrismaMockNoCards();
    const equipped = await loadEquippedCardsAndApply(
      prisma as never,
      "user-x",
      baseStats,
    );
    expect(equipped.spectralSkill).toBeUndefined();

    const state = initBattle({
      battleId: "b1",
      player1: {
        userId: "user-x",
        characterId: "char-x",
        stats: equipped.baseStats,
        skills: [
          makeBasicSkillEquipped("s1"),
          makeBasicSkillEquipped("s2"),
          makeBasicSkillEquipped("s3"),
          makeBasicSkillEquipped("s4"),
        ],
        spectralSkill: equipped.spectralSkill,
      },
      player2: {
        userId: "user-y",
        characterId: "char-y",
        stats: baseStats,
        skills: [makeBasicSkillEquipped("s1")],
      },
    });

    expect(state.players[0].equippedSkills.length).toBe(4);
    expect(
      state.players[0].equippedSkills.every((s) => !s.fromSpectralCard),
    ).toBe(true);
  });

  it("jogador COM cristal Espectral -> config.spectralSkill propagado e vira 5o slot", async () => {
    const prisma = makePrismaMockWithSpectral("skill-spectral-99");
    const equipped = await loadEquippedCardsAndApply(
      prisma as never,
      "user-x",
      baseStats,
    );
    expect(equipped.spectralSkill).toBeDefined();
    expect(equipped.spectralSkill?.skill.id).toBe("skill-spectral-99");
    expect(equipped.spectralSkill?.sourceUserCardId).toBe("uc-spectral-1");

    const state = initBattle({
      battleId: "b2",
      player1: {
        userId: "user-x",
        characterId: "char-x",
        stats: equipped.baseStats,
        skills: [
          makeBasicSkillEquipped("s1"),
          makeBasicSkillEquipped("s2"),
          makeBasicSkillEquipped("s3"),
          makeBasicSkillEquipped("s4"),
        ],
        spectralSkill: equipped.spectralSkill,
      },
      player2: {
        userId: "user-y",
        characterId: "char-y",
        stats: baseStats,
        skills: [makeBasicSkillEquipped("s1")],
      },
    });

    const p1Skills = state.players[0].equippedSkills;
    expect(p1Skills.length).toBe(5);
    const fifth = p1Skills[4];
    expect(fifth.fromSpectralCard).toBe(true);
    expect(fifth.skillId).toBe("skill-spectral-99");
    expect(fifth.sourceUserCardId).toBe("uc-spectral-1");
  });
});
