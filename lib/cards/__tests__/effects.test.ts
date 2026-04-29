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

function card(effects: CardEffect[]): { effects: CardEffect[] } {
  return { effects };
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
});
