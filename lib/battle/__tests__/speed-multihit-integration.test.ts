// Teste de integracao: speed multi-hit em resolveTurn.
//
// Valida que o player MUITO mais rapido executa 2x / 3x / 4x ataques no mesmo
// turno conforme os thresholds (ratio >= 2 / 4 / 8). Diferente do unit test em
// `speed.test.ts` que so valida `calculateExtraActions`, este simula um turno
// completo com `resolveTurn` e conta os eventos `DAMAGE` realmente emitidos.

import { describe, it, expect } from "vitest";
import { initBattle } from "../init";
import { resolveTurn } from "../turn";
import type { BaseStats, EquippedSkill, TurnAction, TurnLogEntry } from "../types";
import type { Skill } from "@/types/skill";

// Skill de baixo dano para nao matar o oponente antes de todos os extras
// (HP do oponente e propositalmente alto para manter a contagem limpa).
const jab: Skill = {
  id: "skill-jab",
  name: "Jab",
  description: "Golpe rapido de baixo dano",
  tier: 1,
  cooldown: 0,
  target: "SINGLE_ENEMY",
  damageType: "PHYSICAL",
  basePower: 10,
  hits: 1,
  accuracy: 100,
  effects: [],
  mastery: {},
};

const slowJab: Skill = {
  id: "skill-slow-jab",
  name: "Slow Jab",
  description: "Para o lado lento usar (irrelevante para a contagem)",
  tier: 1,
  cooldown: 0,
  target: "SINGLE_ENEMY",
  damageType: "PHYSICAL",
  basePower: 5,
  hits: 1,
  accuracy: 100,
  effects: [],
  mastery: {},
};

function makeEquipped(skill: Skill): EquippedSkill {
  return { skillId: skill.id, slotIndex: 0, skill };
}

function makeStats(speed: number): BaseStats {
  return {
    physicalAtk: 20,
    physicalDef: 15,
    magicAtk: 18,
    magicDef: 14,
    // HP altissimo para garantir que ninguem morre antes de todos os hits
    hp: 99_999,
    speed,
  };
}

/** Random determinístico fixo (meio do range de variacao 0.9-1.1). */
const fixedRandom = () => 0.5;

function setupBattle(fastSpeed: number, slowSpeed: number) {
  return initBattle({
    battleId: "speed-multihit-test",
    player1: {
      userId: "fast",
      characterId: "fast-char",
      stats: makeStats(fastSpeed),
      skills: [makeEquipped(jab)],
    },
    player2: {
      userId: "slow",
      characterId: "slow-char",
      stats: makeStats(slowSpeed),
      skills: [makeEquipped(slowJab)],
    },
  });
}

function countDamageBy(events: TurnLogEntry[], actorId: string): number {
  return events.filter(
    (e) => e.phase === "DAMAGE" && e.actorId === actorId
  ).length;
}

function actions(): [TurnAction, TurnAction] {
  return [
    { playerId: "fast", skillId: jab.id },
    { playerId: "slow", skillId: slowJab.id },
  ];
}

describe("speed multi-hit em resolveTurn", () => {
  it("speed igual: 1 ataque (sem extras)", () => {
    const state = setupBattle(100, 100);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    expect(countDamageBy(events, "fast")).toBe(1);
  });

  it("ratio < 2: 1 ataque (sem extras)", () => {
    const state = setupBattle(100, 80);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    expect(countDamageBy(events, "fast")).toBe(1);
  });

  it("ratio = 2 (100 vs 50): 2 ataques (+1 extra)", () => {
    const state = setupBattle(100, 50);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    expect(countDamageBy(events, "fast")).toBe(2);
  });

  it("ratio entre 2 e 4 (100 vs 30): 2 ataques", () => {
    const state = setupBattle(100, 30);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    expect(countDamageBy(events, "fast")).toBe(2);
  });

  it("ratio = 4 (100 vs 25): 3 ataques (+2 extras)", () => {
    const state = setupBattle(100, 25);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    expect(countDamageBy(events, "fast")).toBe(3);
  });

  it("ratio entre 4 e 8 (100 vs 20): 3 ataques", () => {
    const state = setupBattle(100, 20);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    expect(countDamageBy(events, "fast")).toBe(3);
  });

  it("ratio = 8 (800 vs 100): 4 ataques (+3 extras, cap)", () => {
    const state = setupBattle(800, 100);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    expect(countDamageBy(events, "fast")).toBe(4);
  });

  it("ratio muito alto (1000 vs 5): cap em 4 ataques", () => {
    const state = setupBattle(1000, 5);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    expect(countDamageBy(events, "fast")).toBe(4);
  });

  it("emite evento SPEED_ADVANTAGE quando ha extras", () => {
    const state = setupBattle(100, 25);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    const speedEvents = events.filter((e) => e.phase === "SPEED_ADVANTAGE");
    expect(speedEvents.length).toBe(1);
    expect(speedEvents[0].actorId).toBe("fast");
  });

  it("nao emite SPEED_ADVANTAGE quando speeds sao proximos", () => {
    const state = setupBattle(100, 80);
    const { events } = resolveTurn(state, actions(), fixedRandom);
    const speedEvents = events.filter((e) => e.phase === "SPEED_ADVANTAGE");
    expect(speedEvents.length).toBe(0);
  });

  it("dano total escala linear com numero de hits (4 hits ~ 4x dano de 1 hit)", () => {
    const baseState = setupBattle(100, 100); // 1 hit
    const fastState = setupBattle(800, 100); // 4 hits

    const baseRes = resolveTurn(baseState, actions(), fixedRandom);
    const fastRes = resolveTurn(fastState, actions(), fixedRandom);

    const baseDmg = baseRes.events
      .filter((e) => e.phase === "DAMAGE" && e.actorId === "fast")
      .reduce((sum, e) => sum + (e.damage ?? 0), 0);

    const fastDmg = fastRes.events
      .filter((e) => e.phase === "DAMAGE" && e.actorId === "fast")
      .reduce((sum, e) => sum + (e.damage ?? 0), 0);

    // Cada hit individual e ~igual (random fixo). 4 hits devem dar ~4x o dano de 1 hit.
    expect(fastDmg).toBe(baseDmg * 4);
  });
});
