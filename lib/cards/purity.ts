// lib/cards/purity.ts — Curva de purity (drop scaling) para Cristais de Memoria.
//
// Cada UserCard tem um campo `purity` (0-100, inteiro) rolado no momento do drop.
// Purity escala todos os effects via multiplicador `purity / 50`:
//   - 50  -> 1.0x  (baseline, identico ao comportamento pre-Fase 1)
//   - 100 -> 2.0x  (Espectral, "santo graal")
//   - 0   -> 0.0x  (lixo absoluto, effect zerado)
//
// A curva e calibrada para "loteria estilo Pokemon shiny": 100% e 1/200 dos
// drops; entre 90-94 sao ~1 por dia de play casual; o miolo (40-69) e ~55%.
// Cards 3⭐ tem floor de 30 (garantia de minimo valor para a versao mais rara).
//
// Funcao pura. Aceita um RNG injetado para testes deterministicos.

/**
 * Curva de distribuicao de purity. Cada bucket e [min, max] inclusivo
 * com a sua probabilidade acumulada (`cumulative`). A roll faz um unico
 * `rng()` e cai no primeiro bucket cujo `cumulative` cobre o valor.
 *
 * Ordem importa — o predicado e `r < cumulative`, entao o primeiro bucket
 * (mais raro) precisa vir primeiro.
 */
export const PURITY_BUCKETS = [
  /** 0.5% — purity exata 100 (Espectral) */
  { cumulative: 0.005, min: 100, max: 100 },
  /** 3.5% — 95 a 99 */
  { cumulative: 0.04, min: 95, max: 99 },
  /** 7% — 90 a 94 */
  { cumulative: 0.11, min: 90, max: 94 },
  /** 26% — 70 a 89 */
  { cumulative: 0.37, min: 70, max: 89 },
  /** 55% — 40 a 69 */
  { cumulative: 0.92, min: 40, max: 69 },
  /** 8% — 0 a 39 (sem floor; cards 3⭐ ainda recebem floor 30 separadamente) */
  { cumulative: 1.0, min: 0, max: 39 },
] as const;

/** Floor de purity aplicado quando a variante dropada e 3⭐ (`requiredStars === 3`). */
export const THREE_STAR_PURITY_FLOOR = 30;

/** Limites do range de purity (validar boundary do banco e leitura). */
export const PURITY_MIN = 0;
export const PURITY_MAX = 100;

/** Baseline em que `purity / 50` resulta em 1.0x (comportamento pre-Fase 1). */
export const PURITY_BASELINE = 50;

/** Purity exata que marca um Cristal Espectral. */
export const SPECTRAL_PURITY = 100;

/**
 * Rola um valor de purity no momento do drop.
 *
 * @param rng Funcao que retorna numero em [0, 1). Use `Math.random` em producao
 *            e mocks deterministicos em testes.
 * @param requiredStars Stars da variante dropada (1, 2 ou 3). Cards 3⭐ recebem
 *                      `Math.max(THREE_STAR_PURITY_FLOOR, rolled)`.
 * @returns Inteiro em [0, 100].
 */
export function rollPurity(rng: () => number, requiredStars: number): number {
  const r = rng();
  let purity = 0;

  for (const bucket of PURITY_BUCKETS) {
    if (r < bucket.cumulative) {
      const range = bucket.max - bucket.min + 1;
      // Para buckets com range 1 (ex: 100..100), Math.floor(rng * 1) = 0 sempre.
      purity = bucket.min + Math.floor(rng() * range);
      break;
    }
  }

  // Defesa contra edge case (rng() === 1 nao deveria acontecer em rng padrao,
  // mas se acontecer caimos sem `break` — retornamos o ultimo bucket explicitamente).
  if (purity === 0 && r >= PURITY_BUCKETS[PURITY_BUCKETS.length - 1].cumulative) {
    const last = PURITY_BUCKETS[PURITY_BUCKETS.length - 1];
    purity = last.min;
  }

  // Floor para 3⭐.
  if (requiredStars === 3) {
    purity = Math.max(THREE_STAR_PURITY_FLOOR, purity);
  }

  // Clamp defensivo (nao deveria ser necessario, mas garante boundary do banco).
  if (purity < PURITY_MIN) return PURITY_MIN;
  if (purity > PURITY_MAX) return PURITY_MAX;
  return purity;
}

/**
 * Multiplicador de scaling derivado da purity.
 *
 * `purity / PURITY_BASELINE` — em 50 retorna 1.0 (sem alteracao de comportamento),
 * em 100 retorna 2.0, em 0 retorna 0.0 (effect zerado).
 *
 * Inputs invalidos (NaN, undefined) caem para PURITY_BASELINE (1.0x).
 */
export function getPurityMultiplier(purity: number | null | undefined): number {
  if (purity === null || purity === undefined || !Number.isFinite(purity)) {
    return 1;
  }
  // Clamp em [0, 100] antes de dividir.
  const clamped = Math.min(PURITY_MAX, Math.max(PURITY_MIN, Math.floor(purity)));
  return clamped / PURITY_BASELINE;
}

/**
 * Conveniencia: indica se a purity caracteriza um Cristal Espectral.
 * Aceita null/undefined defensivamente (retornam false).
 */
export function isSpectral(purity: number | null | undefined): boolean {
  return purity === SPECTRAL_PURITY;
}
