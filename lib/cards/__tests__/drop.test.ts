import { describe, it, expect } from "vitest";
import { rollCardDrop } from "../drop";
import { TIER_DROP_RATE } from "@/types/cards";

describe("rollCardDrop", () => {
  it("retorna false para tier desconhecido", () => {
    expect(rollCardDrop(0, () => 0)).toBe(false);
    expect(rollCardDrop(99, () => 0)).toBe(false);
  });

  it("retorna true quando random < rate", () => {
    // Tier 1 = 10% — random 0.0 < 0.1
    expect(rollCardDrop(1, () => 0)).toBe(true);
  });

  it("retorna false quando random >= rate (limite exclusivo)", () => {
    // Tier 1 = 10% — random 0.1 NAO e menor que 0.1
    expect(rollCardDrop(1, () => 0.1)).toBe(false);
    // Tier 5 = 0.5% — random 0.005 NAO e menor que 0.005
    expect(rollCardDrop(5, () => 0.005)).toBe(false);
  });

  // Distribuicao estatistica em 10000 rolls — margem proporcional ao rate.
  // Rates baixos (T5=0.5%) precisam de mais amostras para nao terem ruido alto.
  for (const tierStr of Object.keys(TIER_DROP_RATE)) {
    const tier = Number(tierStr);
    const expected = TIER_DROP_RATE[tier];
    const samples = 10000;
    const expectedHits = Math.floor(expected * samples);
    // Margem absoluta = max(30, 50% do esperado). Cobre rates baixos sem ficar trivial.
    const margin = Math.max(30, Math.floor(expectedHits * 0.5));

    it(`distribuicao em ${samples} rolls para tier ${tier} (${(expected * 100).toFixed(2)}%)`, () => {
      // RNG deterministico — Mulberry32
      const rng = createMulberry32(0xdead00 + tier);
      let hits = 0;
      for (let i = 0; i < samples; i++) {
        if (rollCardDrop(tier, rng)) hits += 1;
      }
      expect(hits).toBeGreaterThanOrEqual(expectedHits - margin);
      expect(hits).toBeLessThanOrEqual(expectedHits + margin);
    });
  }
});

// Mulberry32 — gerador deterministico simples para testes.
function createMulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
