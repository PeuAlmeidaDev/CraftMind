import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyCardEffects } from "../effects";
import type { CardEffect } from "@/types/cards";
import type { BaseStats } from "@/lib/battle/types";

const baseStats: BaseStats = {
  physicalAtk: 10,
  physicalDef: 10,
  magicAtk: 10,
  magicDef: 10,
  hp: 100,
  speed: 10,
};

function card(effects: CardEffect[], level: number = 1): { effects: CardEffect[]; level: number } {
  return { effects, level };
}

describe("applyCardEffects", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("retorna stats inalterados (deep equal) quando nao ha cards", () => {
    const result = applyCardEffects(baseStats, []);
    expect(result).toEqual(baseStats);
  });

  it("aplica STAT_FLAT de 1 carta", () => {
    const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 5 }])];
    const result = applyCardEffects(baseStats, cards);
    expect(result.physicalAtk).toBe(15);
    expect(result.physicalDef).toBe(10);
  });

  it("soma STAT_FLAT de 2 cartas no mesmo target", () => {
    const cards = [
      card([{ type: "STAT_FLAT", stat: "magicAtk", value: 4 }]),
      card([{ type: "STAT_FLAT", stat: "magicAtk", value: 6 }]),
    ];
    const result = applyCardEffects(baseStats, cards);
    expect(result.magicAtk).toBe(20); // 10 + 4 + 6
  });

  it("aplica STAT_PERCENT em cima de (base + flat)", () => {
    // (10 + 5) * (1 + 20/100) = 15 * 1.2 = 18
    const cards = [
      card([
        { type: "STAT_FLAT", stat: "speed", value: 5 },
        { type: "STAT_PERCENT", stat: "speed", percent: 20 },
      ]),
    ];
    const result = applyCardEffects(baseStats, cards);
    expect(result.speed).toBe(18);
  });

  it("acumula percents em multiplas cartas e arredonda para baixo", () => {
    // hp: 100 * (1 + 5/100 + 7/100) = 100 * 1.12 = 112
    const cards = [
      card([{ type: "STAT_PERCENT", stat: "hp", percent: 5 }]),
      card([{ type: "STAT_PERCENT", stat: "hp", percent: 7 }]),
    ];
    const result = applyCardEffects(baseStats, cards);
    expect(result.hp).toBe(112);
  });

  it("combina mix de STAT_FLAT e STAT_PERCENT entre 3 cartas", () => {
    // physicalDef: (10 + 3 + 2) * (1 + 10/100) = 15 * 1.1 = 16.5 -> 16
    const cards = [
      card([{ type: "STAT_FLAT", stat: "physicalDef", value: 3 }]),
      card([{ type: "STAT_FLAT", stat: "physicalDef", value: 2 }]),
      card([{ type: "STAT_PERCENT", stat: "physicalDef", percent: 10 }]),
    ];
    const result = applyCardEffects(baseStats, cards);
    expect(result.physicalDef).toBe(16);
  });

  it("nao mexe em stats nao afetados", () => {
    const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 100 }])];
    const result = applyCardEffects(baseStats, cards);
    expect(result.magicAtk).toBe(baseStats.magicAtk);
    expect(result.magicDef).toBe(baseStats.magicDef);
    expect(result.hp).toBe(baseStats.hp);
    expect(result.speed).toBe(baseStats.speed);
    expect(result.physicalDef).toBe(baseStats.physicalDef);
  });

  it("garante minimo 1 mesmo com flat negativo agressivo", () => {
    const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: -999 }])];
    const result = applyCardEffects(baseStats, cards);
    expect(result.physicalAtk).toBe(1);
  });

  it("ignora TRIGGER e STATUS_RESIST silenciosamente (apenas warn)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const cards = [
      card([
        { type: "TRIGGER", trigger: "ON_LOW_HP", payload: { foo: "bar" } },
        { type: "STATUS_RESIST", status: "BURN", percent: 50 },
        { type: "STAT_FLAT", stat: "hp", value: 5 },
      ]),
    ];
    const result = applyCardEffects(baseStats, cards);
    expect(result.hp).toBe(105); // so o flat aplicou
    expect(warnSpy).toHaveBeenCalled();
  });

  describe("level scaling", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    it("Lv2 com STAT_FLAT physicalAtk +5 -> bonus efetivo +6 (floor(5 * 1.2))", () => {
      const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 5 }], 2)];
      const result = applyCardEffects(baseStats, cards);
      // base 10 + floor(5 * 1.2)=6 -> 16
      expect(result.physicalAtk).toBe(16);
    });

    it("Lv3 com STAT_FLAT physicalAtk +5 -> bonus efetivo +7 (floor(5 * 1.4))", () => {
      const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 5 }], 3)];
      const result = applyCardEffects(baseStats, cards);
      // base 10 + floor(5 * 1.4)=7 -> 17
      expect(result.physicalAtk).toBe(17);
    });

    it("Lv5 com STAT_FLAT physicalAtk +5 -> bonus efetivo +9 (floor(5 * 1.8))", () => {
      const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 5 }], 5)];
      const result = applyCardEffects(baseStats, cards);
      // base 10 + floor(5 * 1.8)=9 -> 19
      expect(result.physicalAtk).toBe(19);
    });

    it("Lv5 com STAT_PERCENT physicalAtk +10% -> bonus efetivo +18% no atk final", () => {
      const customBase: BaseStats = {
        physicalAtk: 100,
        physicalDef: 10,
        magicAtk: 10,
        magicDef: 10,
        hp: 100,
        speed: 10,
      };
      const cards = [card([{ type: "STAT_PERCENT", stat: "physicalAtk", percent: 10 }], 5)];
      const result = applyCardEffects(customBase, cards);
      // 100 * (1 + (10 * 1.8)/100) = 100 * 1.18 = 118
      expect(result.physicalAtk).toBe(118);
    });

    it("Lv2 com STAT_FLAT physicalAtk +3 -> bonus efetivo +3 (floor(3 * 1.2)=floor(3.6)=3)", () => {
      const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 3 }], 2)];
      const result = applyCardEffects(baseStats, cards);
      // base 10 + floor(3 * 1.2)=3 -> 13
      expect(result.physicalAtk).toBe(13);
    });

    it("level 99 (clamp para Lv5) tem mesmo resultado do Lv5", () => {
      const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 5 }], 99)];
      const result = applyCardEffects(baseStats, cards);
      // mesmo resultado do teste Lv5
      expect(result.physicalAtk).toBe(19);
    });

    it("level 0 cai em Lv1 (multiplier 1.0)", () => {
      const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 5 }], 0)];
      const result = applyCardEffects(baseStats, cards);
      // base 10 + floor(5 * 1.0)=5 -> 15
      expect(result.physicalAtk).toBe(15);
    });

    it("level NaN cai em Lv1 (multiplier 1.0)", () => {
      const cards = [card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 5 }], Number.NaN)];
      const result = applyCardEffects(baseStats, cards);
      // base 10 + floor(5 * 1.0)=5 -> 15
      expect(result.physicalAtk).toBe(15);
    });

    it("combo 2 cartas STAT_FLAT physicalAtk +5: Lv1 + Lv5 -> bonus flat total 14", () => {
      const cards = [
        card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 5 }], 1),
        card([{ type: "STAT_FLAT", stat: "physicalAtk", value: 5 }], 5),
      ];
      const result = applyCardEffects(baseStats, cards);
      // base 10 + (floor(5*1.0)=5 + floor(5*1.8)=9) = 10 + 14 = 24
      expect(result.physicalAtk).toBe(24);
    });
  });
});
