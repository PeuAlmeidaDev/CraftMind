// lib/cards/__tests__/purity.test.ts
//
// Cobre rollPurity:
//   - Distribuicao em 100k runs com RNG seedado, validando cada bucket dentro
//     de margem 5% absoluta.
//   - Floor de 3⭐ — runs com requiredStars=3 nunca produzem < 30.
//   - Boundary: outputs sempre inteiros em [0, 100].
//
// Cobre getPurityMultiplier e isSpectral em casos de borda.

import { describe, it, expect } from "vitest";
import {
  rollPurity,
  getPurityMultiplier,
  isSpectral,
  PURITY_BUCKETS,
  PURITY_BASELINE,
  PURITY_MAX,
  PURITY_MIN,
  SPECTRAL_PURITY,
  THREE_STAR_PURITY_FLOOR,
} from "../purity";

/**
 * RNG mulberry32 — gerador determinista pequeno e rapido. Suficiente pra
 * validar distribuicao em 100k runs sem flakiness.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_SIZE = 100_000;
const TOLERANCE = 0.05; // 5% absoluto em torno da probabilidade esperada

type Bucket = { min: number; max: number; expected: number; label: string };

// Probabilidades esperadas por bucket (DERIVADAS do PURITY_BUCKETS — diferenca
// entre cumulative atual e o cumulative anterior).
const EXPECTED_BUCKETS: Bucket[] = [
  { min: 0, max: 39, expected: 0.08, label: "0-39" }, // 1.0 - 0.92
  { min: 40, max: 69, expected: 0.55, label: "40-69" }, // 0.92 - 0.37
  { min: 70, max: 89, expected: 0.26, label: "70-89" }, // 0.37 - 0.11
  { min: 90, max: 94, expected: 0.07, label: "90-94" }, // 0.11 - 0.04
  { min: 95, max: 99, expected: 0.035, label: "95-99" }, // 0.04 - 0.005
  { min: 100, max: 100, expected: 0.005, label: "100" }, // 0.005
];

function inBucket(value: number, b: Bucket): boolean {
  return value >= b.min && value <= b.max;
}

describe("rollPurity — distribuicao em 100k samples (requiredStars=1)", () => {
  const rng = mulberry32(0xc0ffee);
  const counts: number[] = EXPECTED_BUCKETS.map(() => 0);
  const allValues: number[] = [];

  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const p = rollPurity(rng, 1);
    allValues.push(p);
    for (let b = 0; b < EXPECTED_BUCKETS.length; b++) {
      if (inBucket(p, EXPECTED_BUCKETS[b])) {
        counts[b]++;
        break;
      }
    }
  }

  it("todos os valores sao inteiros em [0, 100]", () => {
    // Usar reduce em vez de 100k expects (rapido e sem flakiness sob paralelismo).
    let allInts = true;
    let minSeen = Number.POSITIVE_INFINITY;
    let maxSeen = Number.NEGATIVE_INFINITY;
    for (const v of allValues) {
      if (!Number.isInteger(v)) {
        allInts = false;
        break;
      }
      if (v < minSeen) minSeen = v;
      if (v > maxSeen) maxSeen = v;
    }
    expect(allInts).toBe(true);
    expect(minSeen).toBeGreaterThanOrEqual(PURITY_MIN);
    expect(maxSeen).toBeLessThanOrEqual(PURITY_MAX);
  });

  EXPECTED_BUCKETS.forEach((bucket, i) => {
    it(`bucket ${bucket.label} esta dentro de ${TOLERANCE * 100}% da probabilidade esperada (${bucket.expected})`, () => {
      const observed = counts[i] / SAMPLE_SIZE;
      const diff = Math.abs(observed - bucket.expected);
      expect(diff).toBeLessThanOrEqual(TOLERANCE);
    });
  });

  it("a soma das contagens e SAMPLE_SIZE (todo valor caiu em algum bucket)", () => {
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(SAMPLE_SIZE);
  });
});

describe("rollPurity — floor de 3 estrelas", () => {
  it("requiredStars=3 nunca produz purity < 30 em 100k runs", () => {
    const rng = mulberry32(0xdeadbeef);
    let minSeen = PURITY_MAX;
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const p = rollPurity(rng, 3);
      if (p < minSeen) minSeen = p;
    }
    // Um unico assert resumido evita 100k expects (mais rapido e sem timeout).
    expect(minSeen).toBeGreaterThanOrEqual(THREE_STAR_PURITY_FLOOR);
  });

  it("requiredStars=1 e requiredStars=2 NAO aplicam floor (podem cair < 30)", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(43);
    let saw1Below = false;
    let saw2Below = false;
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      if (rollPurity(rng1, 1) < THREE_STAR_PURITY_FLOOR) saw1Below = true;
      if (rollPurity(rng2, 2) < THREE_STAR_PURITY_FLOOR) saw2Below = true;
      if (saw1Below && saw2Below) break;
    }
    expect(saw1Below).toBe(true);
    expect(saw2Below).toBe(true);
  });

  it("requiredStars=3 com rng forcado a cair no bucket 0-39: clampa em 30", () => {
    // rng primeiro = 0.95 (cai no ultimo bucket — 0-39)
    // rng segundo = 0 (escolhe min = 0 dentro do bucket)
    // Sem floor seria 0; com requiredStars=3 vira 30.
    const calls: number[] = [0.95, 0];
    let i = 0;
    const rng = () => calls[i++];
    const result = rollPurity(rng, 3);
    expect(result).toBe(30);
  });

  it("requiredStars=3 nao baixa purity de quem ja estaria acima do floor (ex: 75)", () => {
    // rng primeiro = 0.5 (cai no bucket 40-69) — mas vamos forcar 70-89
    // 0.5 < 0.92 -> bucket 40-69; segundo rng = 0.5 -> 40 + floor(0.5 * 30) = 55
    const calls: number[] = [0.5, 0.5];
    let i = 0;
    const rng = () => calls[i++];
    const result = rollPurity(rng, 3);
    expect(result).toBe(55);
  });
});

describe("rollPurity — boundaries de RNG", () => {
  it("rng() === 0 cai no primeiro bucket (Espectral 100)", () => {
    const result = rollPurity(() => 0, 1);
    expect(result).toBe(SPECTRAL_PURITY);
  });

  it("rng() proximo a 1 cai no ultimo bucket (0-39)", () => {
    // 0.999 esta no ultimo bucket (cumulative=1.0).
    // segundo rng = 0.999 -> 0 + floor(0.999 * 40) = 39
    const calls: number[] = [0.999, 0.999];
    let i = 0;
    const rng = () => calls[i++];
    const result = rollPurity(rng, 1);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(39);
  });

  it("PURITY_BUCKETS soma 1.0 cumulativamente (sanity)", () => {
    const last = PURITY_BUCKETS[PURITY_BUCKETS.length - 1];
    expect(last.cumulative).toBeCloseTo(1.0, 6);
  });
});

describe("getPurityMultiplier", () => {
  it("purity 50 (baseline) retorna 1.0", () => {
    expect(getPurityMultiplier(PURITY_BASELINE)).toBe(1);
  });

  it("purity 100 retorna 2.0", () => {
    expect(getPurityMultiplier(100)).toBe(2);
  });

  it("purity 0 retorna 0", () => {
    expect(getPurityMultiplier(0)).toBe(0);
  });

  it("purity 25 retorna 0.5", () => {
    expect(getPurityMultiplier(25)).toBe(0.5);
  });

  it("purity 75 retorna 1.5", () => {
    expect(getPurityMultiplier(75)).toBe(1.5);
  });

  it("purity NaN cai em baseline (1.0)", () => {
    expect(getPurityMultiplier(Number.NaN)).toBe(1);
  });

  it("purity null cai em baseline (1.0)", () => {
    expect(getPurityMultiplier(null)).toBe(1);
  });

  it("purity undefined cai em baseline (1.0)", () => {
    expect(getPurityMultiplier(undefined)).toBe(1);
  });

  it("purity acima de 100 e clampado em 2.0x (defensivo)", () => {
    expect(getPurityMultiplier(150)).toBe(2);
  });

  it("purity negativo e clampado em 0 (defensivo)", () => {
    expect(getPurityMultiplier(-20)).toBe(0);
  });
});

describe("isSpectral", () => {
  it("100 retorna true", () => {
    expect(isSpectral(100)).toBe(true);
  });

  it("99 retorna false", () => {
    expect(isSpectral(99)).toBe(false);
  });

  it("50 retorna false", () => {
    expect(isSpectral(50)).toBe(false);
  });

  it("null retorna false", () => {
    expect(isSpectral(null)).toBe(false);
  });

  it("undefined retorna false", () => {
    expect(isSpectral(undefined)).toBe(false);
  });
});
