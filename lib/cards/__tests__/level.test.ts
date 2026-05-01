// lib/cards/__tests__/level.test.ts
//
// Cobre as funcoes puras de level/XP de UserCard:
// - Constantes (XP_PER_DUPLICATE_BY_RARITY, CARD_LEVEL_THRESHOLDS).
// - getLevelMultiplier (clamp em [1, CARD_LEVEL_CAP], inputs invalidos).
// - getLevelFromXp (boundaries de cada threshold).
// - applyXpGain (cenarios principais + edge cases de inputs invalidos).

import { describe, it, expect } from "vitest";
import {
  XP_PER_DUPLICATE_BY_RARITY,
  CARD_LEVEL_THRESHOLDS,
  CARD_LEVEL_CAP,
  CARD_LEVEL_MULTIPLIER,
  getLevelMultiplier,
  getLevelFromXp,
  applyXpGain,
} from "../level";

describe("XP_PER_DUPLICATE_BY_RARITY", () => {
  it("COMUM da 50 XP por duplicata", () => {
    expect(XP_PER_DUPLICATE_BY_RARITY.COMUM).toBe(50);
  });

  it("INCOMUM da 100 XP por duplicata", () => {
    expect(XP_PER_DUPLICATE_BY_RARITY.INCOMUM).toBe(100);
  });

  it("RARO da 200 XP por duplicata", () => {
    expect(XP_PER_DUPLICATE_BY_RARITY.RARO).toBe(200);
  });

  it("EPICO da 400 XP por duplicata", () => {
    expect(XP_PER_DUPLICATE_BY_RARITY.EPICO).toBe(400);
  });

  it("LENDARIO da 800 XP por duplicata", () => {
    expect(XP_PER_DUPLICATE_BY_RARITY.LENDARIO).toBe(800);
  });
});

describe("CARD_LEVEL_THRESHOLDS", () => {
  it("indices 1..5 sao [0, 100, 250, 500, 1000]", () => {
    expect(CARD_LEVEL_THRESHOLDS[1]).toBe(0);
    expect(CARD_LEVEL_THRESHOLDS[2]).toBe(100);
    expect(CARD_LEVEL_THRESHOLDS[3]).toBe(250);
    expect(CARD_LEVEL_THRESHOLDS[4]).toBe(500);
    expect(CARD_LEVEL_THRESHOLDS[5]).toBe(1000);
  });

  it("CARD_LEVEL_CAP e 5", () => {
    expect(CARD_LEVEL_CAP).toBe(5);
  });

  it("CARD_LEVEL_MULTIPLIER 1..5 sao [1.0, 1.2, 1.4, 1.6, 1.8]", () => {
    expect(CARD_LEVEL_MULTIPLIER[1]).toBeCloseTo(1.0);
    expect(CARD_LEVEL_MULTIPLIER[2]).toBeCloseTo(1.2);
    expect(CARD_LEVEL_MULTIPLIER[3]).toBeCloseTo(1.4);
    expect(CARD_LEVEL_MULTIPLIER[4]).toBeCloseTo(1.6);
    expect(CARD_LEVEL_MULTIPLIER[5]).toBeCloseTo(1.8);
  });
});

describe("getLevelMultiplier", () => {
  it("Lv1 retorna 1.0", () => {
    expect(getLevelMultiplier(1)).toBeCloseTo(1.0);
  });

  it("Lv2 retorna 1.2", () => {
    expect(getLevelMultiplier(2)).toBeCloseTo(1.2);
  });

  it("Lv3 retorna 1.4", () => {
    expect(getLevelMultiplier(3)).toBeCloseTo(1.4);
  });

  it("Lv4 retorna 1.6", () => {
    expect(getLevelMultiplier(4)).toBeCloseTo(1.6);
  });

  it("Lv5 retorna 1.8", () => {
    expect(getLevelMultiplier(5)).toBeCloseTo(1.8);
  });

  it("level negativo cai em Lv1 (1.0)", () => {
    expect(getLevelMultiplier(-3)).toBeCloseTo(1.0);
  });

  it("level acima do cap cai em Lv5 (1.8)", () => {
    expect(getLevelMultiplier(99)).toBeCloseTo(1.8);
  });

  it("NaN cai em Lv1 (1.0)", () => {
    expect(getLevelMultiplier(Number.NaN)).toBeCloseTo(1.0);
  });

  it("undefined-as-number cai em Lv1 (1.0)", () => {
    expect(getLevelMultiplier(undefined as unknown as number)).toBeCloseTo(1.0);
  });
});

describe("getLevelFromXp", () => {
  it("0 XP -> Lv1", () => {
    expect(getLevelFromXp(0)).toBe(1);
  });

  it("99 XP -> Lv1 (abaixo do threshold de Lv2)", () => {
    expect(getLevelFromXp(99)).toBe(1);
  });

  it("100 XP -> Lv2 (exato no threshold)", () => {
    expect(getLevelFromXp(100)).toBe(2);
  });

  it("249 XP -> Lv2 (abaixo do threshold de Lv3)", () => {
    expect(getLevelFromXp(249)).toBe(2);
  });

  it("250 XP -> Lv3 (exato no threshold)", () => {
    expect(getLevelFromXp(250)).toBe(3);
  });

  it("499 XP -> Lv3 (abaixo do threshold de Lv4)", () => {
    expect(getLevelFromXp(499)).toBe(3);
  });

  it("500 XP -> Lv4 (exato no threshold)", () => {
    expect(getLevelFromXp(500)).toBe(4);
  });

  it("999 XP -> Lv4 (abaixo do threshold de Lv5)", () => {
    expect(getLevelFromXp(999)).toBe(4);
  });

  it("1000 XP -> Lv5 (exato no threshold)", () => {
    expect(getLevelFromXp(1000)).toBe(5);
  });

  it("99999 XP -> Lv5 (cap de level)", () => {
    expect(getLevelFromXp(99999)).toBe(5);
  });

  it("XP negativo -> Lv1 (input invalido tratado)", () => {
    expect(getLevelFromXp(-1)).toBe(1);
  });

  it("NaN -> Lv1 (input invalido tratado)", () => {
    expect(getLevelFromXp(Number.NaN)).toBe(1);
  });
});

describe("applyXpGain", () => {
  it("COMUM em 0 XP / Lv1 -> 50 XP / Lv1 (mesmo level)", () => {
    const result = applyXpGain(0, 1, "COMUM");
    expect(result.xpGained).toBe(50);
    expect(result.newXp).toBe(50);
    expect(result.newLevel).toBe(1);
    expect(result.leveledUp).toBe(false);
  });

  it("COMUM em 50 XP / Lv1 -> 100 XP / Lv2 (level up)", () => {
    const result = applyXpGain(50, 1, "COMUM");
    expect(result.xpGained).toBe(50);
    expect(result.newXp).toBe(100);
    expect(result.newLevel).toBe(2);
    expect(result.leveledUp).toBe(true);
  });

  it("LENDARIO em 0 XP / Lv1 -> 800 XP / Lv4 (multi-level up)", () => {
    const result = applyXpGain(0, 1, "LENDARIO");
    expect(result.xpGained).toBe(800);
    expect(result.newXp).toBe(800);
    expect(result.newLevel).toBe(4);
    expect(result.leveledUp).toBe(true);
  });

  it("LENDARIO em 1500 XP / Lv5 -> 2300 XP / Lv5 (cap, sem level up)", () => {
    const result = applyXpGain(1500, 5, "LENDARIO");
    expect(result.xpGained).toBe(800);
    expect(result.newXp).toBe(2300);
    expect(result.newLevel).toBe(5);
    expect(result.leveledUp).toBe(false);
  });

  it("RARO em 240 XP / Lv2 -> 440 XP / Lv3 (level up)", () => {
    const result = applyXpGain(240, 2, "RARO");
    expect(result.xpGained).toBe(200);
    expect(result.newXp).toBe(440);
    expect(result.newLevel).toBe(3);
    expect(result.leveledUp).toBe(true);
  });

  it("currentXp NaN e tratado como 0", () => {
    const result = applyXpGain(Number.NaN, 1, "COMUM");
    expect(result.newXp).toBe(50);
    expect(result.newLevel).toBe(1);
    expect(result.leveledUp).toBe(false);
  });

  it("currentXp negativo (-10) e tratado como 0", () => {
    const result = applyXpGain(-10, 1, "INCOMUM");
    expect(result.xpGained).toBe(100);
    expect(result.newXp).toBe(100);
    expect(result.newLevel).toBe(2);
    expect(result.leveledUp).toBe(true);
  });

  it("currentLevel -5 e tratado como Lv1 para detectar leveledUp", () => {
    // 50 XP + COMUM = 100 XP -> Lv2; partindo (sanitizado) de Lv1 -> leveledUp true
    const result = applyXpGain(50, -5, "COMUM");
    expect(result.newXp).toBe(100);
    expect(result.newLevel).toBe(2);
    expect(result.leveledUp).toBe(true);
  });

  it("currentLevel NaN e tratado como Lv1 para detectar leveledUp", () => {
    const result = applyXpGain(0, Number.NaN, "COMUM");
    expect(result.newXp).toBe(50);
    expect(result.newLevel).toBe(1);
    expect(result.leveledUp).toBe(false);
  });
});
