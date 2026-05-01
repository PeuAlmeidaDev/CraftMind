// lib/mobs/__tests__/encounter-stars.test.ts
//
// Cobre rollEncounterStars (clamp, distribuicao por probabilidade) e
// applyStarMultiplier (escala dos stats com Math.floor e minimo 1).

import { describe, it, expect } from "vitest";
import {
  rollEncounterStars,
  applyStarMultiplier,
  type StatBlock,
} from "../encounter-stars";

describe("rollEncounterStars", () => {
  it("maxStars=1 sempre retorna 1 (roll=0.0)", () => {
    expect(rollEncounterStars(1, () => 0.0)).toBe(1);
  });

  it("maxStars=1 sempre retorna 1 (roll=0.99)", () => {
    expect(rollEncounterStars(1, () => 0.99)).toBe(1);
  });

  it("maxStars=2 retorna 2 quando roll=0.0 (cai na faixa de 2⭐)", () => {
    // probs[3]=0, probs[2]=0.1 → acc apos 3 = 0; apos 2 = 0.1; 0.0 < 0.1 → 2
    expect(rollEncounterStars(2, () => 0.0)).toBe(2);
  });

  it("maxStars=2 retorna 2 quando roll=0.05", () => {
    expect(rollEncounterStars(2, () => 0.05)).toBe(2);
  });

  it("maxStars=2 retorna 1 quando roll=0.5", () => {
    expect(rollEncounterStars(2, () => 0.5)).toBe(1);
  });

  it("maxStars=2 retorna 1 quando roll=0.99", () => {
    expect(rollEncounterStars(2, () => 0.99)).toBe(1);
  });

  it("maxStars=3 retorna 3 quando roll=0.0", () => {
    // probs[3]=0.05; acc apos 3 = 0.05; 0.0 < 0.05 → 3
    expect(rollEncounterStars(3, () => 0.0)).toBe(3);
  });

  it("maxStars=3 retorna 3 quando roll=0.04", () => {
    expect(rollEncounterStars(3, () => 0.04)).toBe(3);
  });

  it("maxStars=3 retorna 2 quando roll=0.10", () => {
    // acc 0.05+0.15=0.20; 0.10 < 0.20 → 2
    expect(rollEncounterStars(3, () => 0.10)).toBe(2);
  });

  it("maxStars=3 retorna 2 quando roll=0.19", () => {
    expect(rollEncounterStars(3, () => 0.19)).toBe(2);
  });

  it("maxStars=3 retorna 1 quando roll=0.50", () => {
    expect(rollEncounterStars(3, () => 0.50)).toBe(1);
  });

  it("maxStars=0 cai para o clamp inferior (1)", () => {
    expect(rollEncounterStars(0, () => 0)).toBe(1);
  });

  it("maxStars=99 cai para o clamp superior (3) e roll cai em 3", () => {
    expect(rollEncounterStars(99, () => 0)).toBe(3);
  });

  it("maxStars fracionado (2.7) sofre Math.floor → 2", () => {
    expect(rollEncounterStars(2.7, () => 0.0)).toBe(2);
  });
});

describe("applyStarMultiplier", () => {
  it("stars=1 mantem todos os stats iguais", () => {
    const stats: StatBlock = {
      physicalAtk: 10,
      physicalDef: 10,
      magicAtk: 10,
      magicDef: 10,
      hp: 10,
      speed: 10,
    };
    expect(applyStarMultiplier(stats, 1)).toEqual({
      physicalAtk: 10,
      physicalDef: 10,
      magicAtk: 10,
      magicDef: 10,
      hp: 10,
      speed: 10,
    });
  });

  it("stars=2 multiplica todos os stats por 1.5 (atk/def/speed=15, hp=150)", () => {
    const stats: StatBlock = {
      physicalAtk: 10,
      physicalDef: 10,
      magicAtk: 10,
      magicDef: 10,
      hp: 100,
      speed: 10,
    };
    expect(applyStarMultiplier(stats, 2)).toEqual({
      physicalAtk: 15,
      physicalDef: 15,
      magicAtk: 15,
      magicDef: 15,
      hp: 150,
      speed: 15,
    });
  });

  it("stars=3 multiplica todos os stats por 2.5 (atk/def/speed=25, hp=250)", () => {
    const stats: StatBlock = {
      physicalAtk: 10,
      physicalDef: 10,
      magicAtk: 10,
      magicDef: 10,
      hp: 100,
      speed: 10,
    };
    expect(applyStarMultiplier(stats, 3)).toEqual({
      physicalAtk: 25,
      physicalDef: 25,
      magicAtk: 25,
      magicDef: 25,
      hp: 250,
      speed: 25,
    });
  });

  it("stats=0 com stars=3 retorna minimo 1 em todos os campos", () => {
    const stats: StatBlock = {
      physicalAtk: 0,
      physicalDef: 0,
      magicAtk: 0,
      magicDef: 0,
      hp: 0,
      speed: 0,
    };
    expect(applyStarMultiplier(stats, 3)).toEqual({
      physicalAtk: 1,
      physicalDef: 1,
      magicAtk: 1,
      magicDef: 1,
      hp: 1,
      speed: 1,
    });
  });

  it("stats fracionados (7) com stars=2 → Math.floor(7*1.5)=10", () => {
    const stats: StatBlock = {
      physicalAtk: 7,
      physicalDef: 7,
      magicAtk: 7,
      magicDef: 7,
      hp: 7,
      speed: 7,
    };
    expect(applyStarMultiplier(stats, 2)).toEqual({
      physicalAtk: 10,
      physicalDef: 10,
      magicAtk: 10,
      magicDef: 10,
      hp: 10,
      speed: 10,
    });
  });
});
