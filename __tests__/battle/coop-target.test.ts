import { describe, it, expect } from "vitest";
import { chooseBossTarget, resolveCoopTargets } from "@/lib/battle/coop-target";
import type { PlayerState, BaseStats, EquippedSkill } from "@/lib/battle/types";
import type { Skill, SkillTarget } from "@/types/skill";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides?: Partial<Skill>): Skill {
  return {
    id: "test-skill",
    name: "Test Skill",
    description: "Skill de teste",
    tier: 1,
    cooldown: 0,
    target: "SINGLE_ENEMY",
    damageType: "PHYSICAL",
    basePower: 50,
    hits: 1,
    accuracy: 100,
    effects: [],
    mastery: {},
    ...overrides,
  };
}

function makeEquipped(skill: Skill, slot: number): EquippedSkill {
  return { skillId: skill.id, slotIndex: slot, skill };
}

function makeStats(overrides?: Partial<BaseStats>): BaseStats {
  return {
    physicalAtk: 20,
    physicalDef: 15,
    magicAtk: 18,
    magicDef: 14,
    hp: 200,
    speed: 15,
    ...overrides,
  };
}

function createMockPlayerState(overrides?: Partial<PlayerState>): PlayerState {
  const skill = makeSkill();
  const stats = makeStats(overrides?.baseStats);
  return {
    playerId: "player-1",
    characterId: "char-1",
    baseStats: stats,
    currentHp: overrides?.currentHp ?? stats.hp,
    stages: {
      physicalAtk: 0,
      physicalDef: 0,
      magicAtk: 0,
      magicDef: 0,
      speed: 0,
      accuracy: 0,
    },
    statusEffects: [],
    buffs: [],
    vulnerabilities: [],
    counters: [],
    cooldowns: {},
    combo: { skillId: null, stacks: 0 },
    equippedSkills: [makeEquipped(skill, 0)],
    ...overrides,
  };
}

const fixedRandom = () => 0.5;

// ---------------------------------------------------------------------------
// chooseBossTarget
// ---------------------------------------------------------------------------

describe("chooseBossTarget", () => {
  it("retorna player com menor HP percentual", () => {
    const p1 = createMockPlayerState({
      playerId: "p1",
      baseStats: makeStats({ hp: 200 }),
      currentHp: 100, // 50%
    });
    const p2 = createMockPlayerState({
      playerId: "p2",
      baseStats: makeStats({ hp: 200 }),
      currentHp: 60, // 30%
    });
    const p3 = createMockPlayerState({
      playerId: "p3",
      baseStats: makeStats({ hp: 200 }),
      currentHp: 180, // 90%
    });

    const target = chooseBossTarget([p1, p2, p3], fixedRandom);
    expect(target).toBe("p2");
  });

  it("empate HP: retorna player com menos buffs defensivos", () => {
    const p1 = createMockPlayerState({
      playerId: "p1",
      baseStats: makeStats({ hp: 200 }),
      currentHp: 100,
      buffs: [
        {
          id: "b1",
          source: "BUFF",
          stat: "physicalDef",
          value: 2,
          remainingTurns: 3,
        },
      ],
    });
    const p2 = createMockPlayerState({
      playerId: "p2",
      baseStats: makeStats({ hp: 200 }),
      currentHp: 100, // mesmo HP percentual que p1
      buffs: [], // sem buffs defensivos
    });

    const target = chooseBossTarget([p1, p2], fixedRandom);
    expect(target).toBe("p2");
  });

  it("empate total: usa randomFn para desempatar", () => {
    const p1 = createMockPlayerState({
      playerId: "p1",
      baseStats: makeStats({ hp: 200 }),
      currentHp: 100,
      buffs: [],
    });
    const p2 = createMockPlayerState({
      playerId: "p2",
      baseStats: makeStats({ hp: 200 }),
      currentHp: 100,
      buffs: [],
    });

    // randomFn retorna 0.0 → Math.floor(0.0 * 2) = 0 → primeiro
    const target0 = chooseBossTarget([p1, p2], () => 0.0);
    expect(target0).toBe("p1");

    // randomFn retorna 0.99 → Math.floor(0.99 * 2) = 1 → segundo
    const target1 = chooseBossTarget([p1, p2], () => 0.99);
    expect(target1).toBe("p2");
  });

  it("ignora players mortos (currentHp <= 0)", () => {
    const dead = createMockPlayerState({
      playerId: "dead",
      currentHp: 0,
    });
    const alive = createMockPlayerState({
      playerId: "alive",
      currentHp: 100,
    });

    const target = chooseBossTarget([dead, alive], fixedRandom);
    expect(target).toBe("alive");
  });

  it("lanca erro se nenhum player vivo", () => {
    const dead1 = createMockPlayerState({ playerId: "d1", currentHp: 0 });
    const dead2 = createMockPlayerState({ playerId: "d2", currentHp: 0 });

    expect(() => chooseBossTarget([dead1, dead2], fixedRandom)).toThrow(
      "Nenhum player vivo"
    );
  });

  it("retorna unico player vivo diretamente", () => {
    const alive = createMockPlayerState({
      playerId: "solo",
      currentHp: 50,
    });

    const target = chooseBossTarget([alive], fixedRandom);
    expect(target).toBe("solo");
  });
});

// ---------------------------------------------------------------------------
// resolveCoopTargets
// ---------------------------------------------------------------------------

describe("resolveCoopTargets", () => {
  const boss = createMockPlayerState({
    playerId: "boss",
    baseStats: makeStats({ hp: 1000 }),
    currentHp: 1000,
  });

  const p1 = createMockPlayerState({ playerId: "p1", currentHp: 150 });
  const p2 = createMockPlayerState({ playerId: "p2", currentHp: 100 });
  const p3 = createMockPlayerState({ playerId: "p3", currentHp: 0 }); // morto

  const team = [p1, p2, p3];

  // --- Boss como caster ---

  describe("boss como caster", () => {
    it("SINGLE_ENEMY: retorna 1 player vivo", () => {
      const targets = resolveCoopTargets({
        casterSide: "boss",
        caster: boss,
        skillTarget: "SINGLE_ENEMY",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].currentHp).toBeGreaterThan(0);
    });

    it("ALL_ENEMIES: retorna todos players vivos (ignora mortos)", () => {
      const targets = resolveCoopTargets({
        casterSide: "boss",
        caster: boss,
        skillTarget: "ALL_ENEMIES",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(2);
      expect(targets.every((t) => t.currentHp > 0)).toBe(true);
      expect(targets.find((t) => t.playerId === "p3")).toBeUndefined();
    });

    it("SELF: retorna [boss]", () => {
      const targets = resolveCoopTargets({
        casterSide: "boss",
        caster: boss,
        skillTarget: "SELF",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].playerId).toBe("boss");
    });

    it("ALL: retorna boss + todos players vivos", () => {
      const targets = resolveCoopTargets({
        casterSide: "boss",
        caster: boss,
        skillTarget: "ALL",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(3); // boss + p1 + p2
      expect(targets[0].playerId).toBe("boss");
      expect(targets.find((t) => t.playerId === "p3")).toBeUndefined();
    });
  });

  // --- Player como caster ---

  describe("player como caster", () => {
    it("SINGLE_ENEMY: retorna [boss]", () => {
      const targets = resolveCoopTargets({
        casterSide: "team",
        caster: p1,
        skillTarget: "SINGLE_ENEMY",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].playerId).toBe("boss");
    });

    it("ALL_ENEMIES: retorna [boss]", () => {
      const targets = resolveCoopTargets({
        casterSide: "team",
        caster: p1,
        skillTarget: "ALL_ENEMIES",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].playerId).toBe("boss");
    });

    it("SELF: retorna [caster]", () => {
      const targets = resolveCoopTargets({
        casterSide: "team",
        caster: p1,
        skillTarget: "SELF",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].playerId).toBe("p1");
    });

    it("SINGLE_ALLY com targetId valido: retorna player correto", () => {
      const targets = resolveCoopTargets({
        casterSide: "team",
        caster: p1,
        skillTarget: "SINGLE_ALLY",
        team,
        boss,
        targetId: "p2",
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].playerId).toBe("p2");
    });

    it("SINGLE_ALLY com targetId invalido: fallback para caster", () => {
      const targets = resolveCoopTargets({
        casterSide: "team",
        caster: p1,
        skillTarget: "SINGLE_ALLY",
        team,
        boss,
        targetId: "invalid-id",
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].playerId).toBe("p1");
    });

    it("SINGLE_ALLY com targetId de player morto: fallback para caster", () => {
      const targets = resolveCoopTargets({
        casterSide: "team",
        caster: p1,
        skillTarget: "SINGLE_ALLY",
        team,
        boss,
        targetId: "p3", // p3 esta morto
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].playerId).toBe("p1");
    });

    it("SINGLE_ALLY sem targetId: fallback para caster", () => {
      const targets = resolveCoopTargets({
        casterSide: "team",
        caster: p1,
        skillTarget: "SINGLE_ALLY",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].playerId).toBe("p1");
    });

    it("ALL_ALLIES: retorna todos players vivos", () => {
      const targets = resolveCoopTargets({
        casterSide: "team",
        caster: p1,
        skillTarget: "ALL_ALLIES",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(2); // p1 + p2 (p3 morto)
      expect(targets.every((t) => t.currentHp > 0)).toBe(true);
    });

    it("ALL: retorna boss + todos players vivos", () => {
      const targets = resolveCoopTargets({
        casterSide: "team",
        caster: p1,
        skillTarget: "ALL",
        team,
        boss,
        randomFn: fixedRandom,
      });

      expect(targets).toHaveLength(3); // boss + p1 + p2
      expect(targets[0].playerId).toBe("boss");
      expect(targets.find((t) => t.playerId === "p3")).toBeUndefined();
    });
  });
});
