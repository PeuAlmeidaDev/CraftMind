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
  getXpProgress,
  getDuplicateCount,
  scaleEffectForDisplay,
} from "../level";
import type {
  CardEffect,
  CardStatFlatEffect,
  CardStatPercentEffect,
  CardTriggerEffect,
  CardStatusResistEffect,
} from "@/types/cards";

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

describe("getXpProgress", () => {
  it("xp=0 / Lv1 -> { current: 0, needed: 100, ratio: 0, isMax: false }", () => {
    const result = getXpProgress(0, 1);
    expect(result.current).toBe(0);
    expect(result.needed).toBe(100);
    expect(result.ratio).toBe(0);
    expect(result.isMax).toBe(false);
  });

  it("xp=50 / Lv1 -> 50% do caminho ate Lv2 (50/100)", () => {
    const result = getXpProgress(50, 1);
    expect(result.current).toBe(50);
    expect(result.needed).toBe(100);
    expect(result.ratio).toBeCloseTo(0.5);
    expect(result.isMax).toBe(false);
  });

  it("xp=175 / Lv3 -> { current: -75... mas Lv3 comeca em 250 }", () => {
    // xp=175 esta abaixo do threshold de Lv3 (250). O caller passou level=3
    // mesmo assim — funcao trata defensivamente clampando current em 0.
    const result = getXpProgress(175, 3);
    expect(result.current).toBe(0);
    expect(result.needed).toBe(250);
    expect(result.ratio).toBe(0);
    expect(result.isMax).toBe(false);
  });

  it("xp=375 / Lv3 -> 50% (375 - 250 = 125 de 250 ate Lv4)", () => {
    const result = getXpProgress(375, 3);
    expect(result.current).toBe(125);
    expect(result.needed).toBe(250);
    expect(result.ratio).toBeCloseTo(0.5);
    expect(result.isMax).toBe(false);
  });

  it("xp=500 / Lv4 (exato no threshold) -> { current: 0, needed: 500 }", () => {
    const result = getXpProgress(500, 4);
    expect(result.current).toBe(0);
    expect(result.needed).toBe(500);
    expect(result.ratio).toBe(0);
    expect(result.isMax).toBe(false);
  });

  it("xp=999 / Lv4 -> 99.8% rumo a Lv5 (499/500)", () => {
    const result = getXpProgress(999, 4);
    expect(result.current).toBe(499);
    expect(result.needed).toBe(500);
    expect(result.ratio).toBeCloseTo(0.998);
    expect(result.isMax).toBe(false);
  });

  it("xp=1000 / Lv5 -> isMax true, ratio 1, needed 0", () => {
    const result = getXpProgress(1000, 5);
    expect(result.isMax).toBe(true);
    expect(result.ratio).toBe(1);
    expect(result.needed).toBe(0);
  });

  it("xp=2300 / Lv5 (excedente apos cap) -> ainda isMax true", () => {
    const result = getXpProgress(2300, 5);
    expect(result.isMax).toBe(true);
    expect(result.ratio).toBe(1);
    expect(result.needed).toBe(0);
  });

  it("level > 5 (defensivo) e clampado para Lv5 -> isMax true", () => {
    const result = getXpProgress(5000, 99);
    expect(result.isMax).toBe(true);
    expect(result.ratio).toBe(1);
  });

  it("xp negativo -> estado neutro (0/100, ratio 0)", () => {
    const result = getXpProgress(-50, 2);
    expect(result.current).toBe(0);
    expect(result.needed).toBe(100);
    expect(result.ratio).toBe(0);
    expect(result.isMax).toBe(false);
  });

  it("xp NaN -> estado neutro (0/100, ratio 0)", () => {
    const result = getXpProgress(Number.NaN, 1);
    expect(result.current).toBe(0);
    expect(result.needed).toBe(100);
    expect(result.ratio).toBe(0);
    expect(result.isMax).toBe(false);
  });

  it("level NaN -> estado neutro", () => {
    const result = getXpProgress(50, Number.NaN);
    expect(result.current).toBe(0);
    expect(result.needed).toBe(100);
    expect(result.ratio).toBe(0);
    expect(result.isMax).toBe(false);
  });

  it("level 0 (invalido) -> estado neutro", () => {
    const result = getXpProgress(50, 0);
    expect(result.current).toBe(0);
    expect(result.needed).toBe(100);
    expect(result.ratio).toBe(0);
    expect(result.isMax).toBe(false);
  });
});

describe("getDuplicateCount", () => {
  it("xp=0 retorna 0 para qualquer raridade", () => {
    expect(getDuplicateCount(0, "COMUM")).toBe(0);
    expect(getDuplicateCount(0, "INCOMUM")).toBe(0);
    expect(getDuplicateCount(0, "RARO")).toBe(0);
    expect(getDuplicateCount(0, "EPICO")).toBe(0);
    expect(getDuplicateCount(0, "LENDARIO")).toBe(0);
  });

  it("COMUM: 50 XP -> 1 duplicata (50/50)", () => {
    expect(getDuplicateCount(50, "COMUM")).toBe(1);
  });

  it("COMUM: 250 XP -> 5 duplicatas", () => {
    expect(getDuplicateCount(250, "COMUM")).toBe(5);
  });

  it("INCOMUM: 350 XP -> 3 duplicatas (floor 350/100)", () => {
    expect(getDuplicateCount(350, "INCOMUM")).toBe(3);
  });

  it("RARO: 800 XP -> 4 duplicatas (800/200)", () => {
    expect(getDuplicateCount(800, "RARO")).toBe(4);
  });

  it("RARO: 199 XP -> 0 duplicatas (floor abaixo do limite)", () => {
    expect(getDuplicateCount(199, "RARO")).toBe(0);
  });

  it("EPICO: 1500 XP -> 3 duplicatas (1500/400 = 3.75 -> 3)", () => {
    expect(getDuplicateCount(1500, "EPICO")).toBe(3);
  });

  it("LENDARIO: 800 XP -> 1 duplicata", () => {
    expect(getDuplicateCount(800, "LENDARIO")).toBe(1);
  });

  it("LENDARIO: 4000 XP -> 5 duplicatas", () => {
    expect(getDuplicateCount(4000, "LENDARIO")).toBe(5);
  });

  it("xp gigante: 100000 XP em COMUM -> 2000 duplicatas", () => {
    expect(getDuplicateCount(100_000, "COMUM")).toBe(2000);
  });

  it("xp negativo retorna 0", () => {
    expect(getDuplicateCount(-50, "COMUM")).toBe(0);
  });

  it("xp NaN retorna 0", () => {
    expect(getDuplicateCount(Number.NaN, "RARO")).toBe(0);
  });
});

describe("scaleEffectForDisplay", () => {
  const flatEffect: CardStatFlatEffect = {
    type: "STAT_FLAT",
    stat: "physicalAtk",
    value: 5,
  };

  const percentEffect: CardStatPercentEffect = {
    type: "STAT_PERCENT",
    stat: "magicDef",
    percent: 10,
  };

  const triggerEffect: CardTriggerEffect = {
    type: "TRIGGER",
    trigger: "ON_LOW_HP",
    payload: { threshold: 0.25, action: "buff_self" },
  };

  const resistEffect: CardStatusResistEffect = {
    type: "STATUS_RESIST",
    status: "BURN",
    percent: 50,
  };

  it("STAT_FLAT em Lv1 retorna o mesmo valor (mult=1.0)", () => {
    const result = scaleEffectForDisplay(flatEffect, 1);
    expect(result.type).toBe("STAT_FLAT");
    if (result.type === "STAT_FLAT") {
      expect(result.value).toBe(5);
      expect(result.stat).toBe("physicalAtk");
    }
  });

  it("STAT_FLAT em Lv5: value=5 -> floor(5 * 1.8) = 9", () => {
    const result = scaleEffectForDisplay(flatEffect, 5);
    if (result.type === "STAT_FLAT") {
      expect(result.value).toBe(9);
    } else {
      throw new Error("expected STAT_FLAT");
    }
  });

  it("STAT_FLAT em Lv3: value=5 -> floor(5 * 1.4) = 7 (floor de 7.0)", () => {
    const result = scaleEffectForDisplay(flatEffect, 3);
    if (result.type === "STAT_FLAT") {
      expect(result.value).toBe(7);
    } else {
      throw new Error("expected STAT_FLAT");
    }
  });

  it("STAT_FLAT com value negativo em Lv5: floor(-5 * 1.8) = -9", () => {
    const negative: CardStatFlatEffect = { type: "STAT_FLAT", stat: "speed", value: -5 };
    const result = scaleEffectForDisplay(negative, 5);
    if (result.type === "STAT_FLAT") {
      expect(result.value).toBe(-9);
    } else {
      throw new Error("expected STAT_FLAT");
    }
  });

  it("STAT_PERCENT em Lv3: percent=10 -> 10 * 1.4 = 14 (sem floor)", () => {
    const result = scaleEffectForDisplay(percentEffect, 3);
    if (result.type === "STAT_PERCENT") {
      expect(result.percent).toBeCloseTo(14);
      expect(result.stat).toBe("magicDef");
    } else {
      throw new Error("expected STAT_PERCENT");
    }
  });

  it("STAT_PERCENT em Lv5: percent=10 -> 10 * 1.8 = 18 (sem floor)", () => {
    const result = scaleEffectForDisplay(percentEffect, 5);
    if (result.type === "STAT_PERCENT") {
      expect(result.percent).toBeCloseTo(18);
    } else {
      throw new Error("expected STAT_PERCENT");
    }
  });

  it("STAT_PERCENT com fracao em Lv2: percent=7 -> 7 * 1.2 = 8.4 (sem floor)", () => {
    const fractional: CardStatPercentEffect = { type: "STAT_PERCENT", stat: "hp", percent: 7 };
    const result = scaleEffectForDisplay(fractional, 2);
    if (result.type === "STAT_PERCENT") {
      expect(result.percent).toBeCloseTo(8.4);
    } else {
      throw new Error("expected STAT_PERCENT");
    }
  });

  it("TRIGGER passa inalterado em Lv5 (mas em copia rasa)", () => {
    const result = scaleEffectForDisplay(triggerEffect, 5);
    expect(result.type).toBe("TRIGGER");
    if (result.type === "TRIGGER") {
      expect(result.trigger).toBe("ON_LOW_HP");
      expect(result.payload).toEqual({ threshold: 0.25, action: "buff_self" });
    }
  });

  it("STATUS_RESIST passa inalterado em Lv5 (mas em copia rasa)", () => {
    const result = scaleEffectForDisplay(resistEffect, 5);
    expect(result.type).toBe("STATUS_RESIST");
    if (result.type === "STATUS_RESIST") {
      expect(result.status).toBe("BURN");
      expect(result.percent).toBe(50);
    }
  });

  it("nao muta o input original (STAT_FLAT)", () => {
    const original: CardStatFlatEffect = { type: "STAT_FLAT", stat: "hp", value: 10 };
    const snapshotValue = original.value;
    const result = scaleEffectForDisplay(original, 5);
    expect(original.value).toBe(snapshotValue);
    expect(result).not.toBe(original);
  });

  it("nao muta o input original (STAT_PERCENT)", () => {
    const original: CardStatPercentEffect = { type: "STAT_PERCENT", stat: "physicalDef", percent: 5 };
    const snapshotPercent = original.percent;
    const result = scaleEffectForDisplay(original, 4);
    expect(original.percent).toBe(snapshotPercent);
    expect(result).not.toBe(original);
  });

  it("retorna copia rasa para TRIGGER (referencia diferente)", () => {
    const result = scaleEffectForDisplay(triggerEffect, 3);
    expect(result).not.toBe(triggerEffect);
  });

  it("level invalido (NaN) clampa para Lv1: STAT_FLAT inalterado", () => {
    const result = scaleEffectForDisplay(flatEffect, Number.NaN);
    if (result.type === "STAT_FLAT") {
      expect(result.value).toBe(5);
    } else {
      throw new Error("expected STAT_FLAT");
    }
  });

  it("aceita CardEffect generico (uniao discriminada)", () => {
    const generic: CardEffect = flatEffect;
    const result = scaleEffectForDisplay(generic, 5);
    expect(result.type).toBe("STAT_FLAT");
  });
});
