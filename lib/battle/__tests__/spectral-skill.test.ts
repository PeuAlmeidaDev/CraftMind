// lib/battle/__tests__/spectral-skill.test.ts
//
// Cobre o 5o slot de skill (Cristal Espectral, purity 100) na engine de
// batalha. Valida:
//   - initBattle sem spectralSkill -> equippedSkills.length === 4 (regressao)
//   - initBattle com spectralSkill -> equippedSkills.length === 5, ultima
//     com `fromSpectralCard: true` e `sourceUserCardId` setado
//   - Skill espectral disparavel no turno 1 (cooldown inicial 0)
//   - Apos uso, entra no cooldown normal definido em Skill.cooldown
//   - Aparece corretamente em getAvailableSkills (e some quando em cooldown)
//   - Combo state zera ao trocar de skill espectral pra outra (comportamento
//     padrao da engine — nao precisa branch novo)

import { describe, it, expect } from "vitest";
import { initBattle } from "../init";
import { resolveTurn } from "../turn";
import { getAvailableSkills } from "../skills";
import type { BaseStats, EquippedSkill } from "../types";
import type { Skill } from "@/types/skill";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeSkill(
  overrides: Partial<Skill> & Pick<Skill, "id" | "name" | "effects">
): Skill {
  return {
    description: "Skill de teste",
    tier: 1,
    cooldown: 0,
    target: "SINGLE_ENEMY",
    damageType: "PHYSICAL",
    basePower: 40,
    hits: 1,
    accuracy: 100,
    mastery: {},
    ...overrides,
  };
}

function makeEquipped(skill: Skill, slot: number): EquippedSkill {
  return { skillId: skill.id, slotIndex: slot, skill };
}

const basicAttack: Skill = makeSkill({
  id: "basic-attack",
  name: "Ataque Basico",
  effects: [],
});

const otherAttack: Skill = makeSkill({
  id: "other-attack",
  name: "Outro Ataque",
  effects: [],
});

const spectralBlast: Skill = makeSkill({
  id: "spectral-blast",
  name: "Explosao Espectral",
  basePower: 60,
  cooldown: 2,
  effects: [],
});

const alwaysHitRandom = () => 0.01;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Spectral skill (5o slot)", () => {
  it("initBattle sem spectralSkill mantem 4 skills (regressao)", () => {
    const state = initBattle({
      battleId: "battle-1",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats(),
        skills: [
          makeEquipped(basicAttack, 0),
          makeEquipped(otherAttack, 1),
          makeEquipped(makeSkill({ id: "s3", name: "S3", effects: [] }), 2),
          makeEquipped(makeSkill({ id: "s4", name: "S4", effects: [] }), 3),
        ],
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    expect(state.players[0].equippedSkills.length).toBe(4);
    expect(state.players[0].equippedSkills.every((s) => !s.fromSpectralCard)).toBe(
      true
    );
    expect(state.players[1].equippedSkills.length).toBe(1);
  });

  it("initBattle com spectralSkill anexa o 5o slot com fromSpectralCard: true", () => {
    const state = initBattle({
      battleId: "battle-2",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats(),
        skills: [
          makeEquipped(basicAttack, 0),
          makeEquipped(otherAttack, 1),
          makeEquipped(makeSkill({ id: "s3", name: "S3", effects: [] }), 2),
          makeEquipped(makeSkill({ id: "s4", name: "S4", effects: [] }), 3),
        ],
        spectralSkill: {
          skill: spectralBlast,
          sourceUserCardId: "uc-spectral-1",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const p1Skills = state.players[0].equippedSkills;
    expect(p1Skills.length).toBe(5);
    const fifth = p1Skills[4];
    expect(fifth.fromSpectralCard).toBe(true);
    expect(fifth.skillId).toBe(spectralBlast.id);
    expect(fifth.sourceUserCardId).toBe("uc-spectral-1");
    expect(fifth.slotIndex).toBe(4);
    // Skills normais nao tem a flag
    expect(p1Skills.slice(0, 4).every((s) => !s.fromSpectralCard)).toBe(true);
  });

  it("skill espectral fica disponivel no turno 1 (cooldown inicial 0)", () => {
    const state = initBattle({
      battleId: "battle-3",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralBlast,
          sourceUserCardId: "uc-x",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const available = getAvailableSkills(state.players[0]);
    expect(available.find((es) => es.skillId === spectralBlast.id)).toBeDefined();
  });

  it("apos uso, skill espectral entra em cooldown normal e some de getAvailableSkills", () => {
    const state = initBattle({
      battleId: "battle-4",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 100 }),
        skills: [makeEquipped(basicAttack, 0)],
        spectralSkill: {
          skill: spectralBlast,
          sourceUserCardId: "uc-x",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const result = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: spectralBlast.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );

    // Cooldown da spectralBlast eh 2 turnos -> deve estar > 0 apos uso
    expect(result.state.players[0].cooldowns[spectralBlast.id]).toBeGreaterThan(0);

    const availableAfter = getAvailableSkills(result.state.players[0]);
    expect(
      availableAfter.find((es) => es.skillId === spectralBlast.id)
    ).toBeUndefined();

    // Skill normal ainda disponivel
    expect(
      availableAfter.find((es) => es.skillId === basicAttack.id)
    ).toBeDefined();
  });

  it("getAvailableSkills inclui o 5o slot espectral quando nao em cooldown", () => {
    const state = initBattle({
      battleId: "battle-5",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats(),
        skills: [
          makeEquipped(basicAttack, 0),
          makeEquipped(otherAttack, 1),
          makeEquipped(makeSkill({ id: "s3", name: "S3", effects: [] }), 2),
          makeEquipped(makeSkill({ id: "s4", name: "S4", effects: [] }), 3),
        ],
        spectralSkill: {
          skill: spectralBlast,
          sourceUserCardId: "uc-x",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats(),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    const available = getAvailableSkills(state.players[0]);
    expect(available.length).toBe(5);
    const spectral = available.find((es) => es.fromSpectralCard);
    expect(spectral).toBeDefined();
    expect(spectral?.skillId).toBe(spectralBlast.id);
  });

  it("combo state da skill espectral reseta ao trocar pra outra skill COMBO (comportamento padrao)", () => {
    // Skill espectral COMBO: cresce a cada uso consecutivo. Ao trocar pra
    // outra skill COMBO diferente, o stacks reseta pra 1.
    const spectralCombo: Skill = makeSkill({
      id: "spectral-combo",
      name: "Combo Espectral",
      basePower: 30,
      cooldown: 0,
      effects: [
        {
          type: "COMBO",
          maxStacks: 3,
          escalation: [
            { basePower: 30, hits: 1 },
            { basePower: 50, hits: 1 },
            { basePower: 80, hits: 1 },
          ],
        },
      ],
    });

    const otherCombo: Skill = makeSkill({
      id: "other-combo",
      name: "Outro Combo",
      basePower: 30,
      effects: [
        {
          type: "COMBO",
          maxStacks: 3,
          escalation: [
            { basePower: 30, hits: 1 },
            { basePower: 50, hits: 1 },
            { basePower: 80, hits: 1 },
          ],
        },
      ],
    });

    // Speed baixo para evitar extra-actions atrapalharem o stack count
    const state = initBattle({
      battleId: "battle-7",
      player1: {
        userId: "p1",
        characterId: "c1",
        stats: makeStats({ speed: 15, hp: 5000 }),
        skills: [makeEquipped(otherCombo, 0)],
        spectralSkill: {
          skill: spectralCombo,
          sourceUserCardId: "uc-x",
        },
      },
      player2: {
        userId: "p2",
        characterId: "c2",
        stats: makeStats({ speed: 15, hp: 5000 }),
        skills: [makeEquipped(basicAttack, 0)],
      },
    });

    // Turno 1: usa spectralCombo (skill espectral) -> combo armazena spectralCombo.id
    const t1 = resolveTurn(
      state,
      [
        { playerId: "p1", skillId: spectralCombo.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );
    expect(t1.state.players[0].combo.skillId).toBe(spectralCombo.id);
    const stacksAfterT1 = t1.state.players[0].combo.stacks;
    expect(stacksAfterT1).toBeGreaterThanOrEqual(1);

    // Turno 2: troca pra otherCombo -> stacks deve resetar pra 1 (skillId muda)
    const t2 = resolveTurn(
      t1.state,
      [
        { playerId: "p1", skillId: otherCombo.id },
        { playerId: "p2", skillId: basicAttack.id },
      ],
      alwaysHitRandom
    );
    expect(t2.state.players[0].combo.skillId).toBe(otherCombo.id);
    expect(t2.state.players[0].combo.stacks).toBe(1);
  });
});
