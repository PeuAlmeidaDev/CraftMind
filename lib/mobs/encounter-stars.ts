// lib/mobs/encounter-stars.ts — Estrela do encontro PvE.
//
// Quando um mob tem `maxStars > 1`, sorteia a versao do encontro:
//   maxStars=1 → sempre 1⭐ (mob comum, sem variacao)
//   maxStars=2 → 90% / 10%   (1⭐ / 2⭐)
//   maxStars=3 → 80% / 15% / 5%  (1⭐ / 2⭐ / 3⭐)
//
// O multiplicador aplicado aos stats do mob naquele combate:
//   1⭐ → ×1.0 (base)
//   2⭐ → ×1.5
//   3⭐ → ×2.5
//
// Nada disso persiste — o mob no banco continua igual; so a INSTANCIA do
// combate fica mais forte. A estrela do encontro fica guardada no state
// em memoria da batalha para definir quais cartas podem cair.

export type EncounterStars = 1 | 2 | 3;

export const STAR_STAT_MULTIPLIER: Record<EncounterStars, number> = {
  1: 1.0,
  2: 1.5,
  3: 2.5,
};

/** Tabela de probabilidades por maxStars. Chaves sao numero, valores em 0-1. */
const ENCOUNTER_PROBABILITY: Record<number, Record<EncounterStars, number>> = {
  1: { 1: 1.0, 2: 0, 3: 0 },
  2: { 1: 0.9, 2: 0.1, 3: 0 },
  3: { 1: 0.8, 2: 0.15, 3: 0.05 },
};

export function rollEncounterStars(
  maxStars: number,
  randomFn: () => number = Math.random,
): EncounterStars {
  // Clamp + fallback: maxStars fora de [1,3] cai para o limite mais proximo
  const safe = Math.min(3, Math.max(1, Math.floor(maxStars))) as 1 | 2 | 3;
  const probs = ENCOUNTER_PROBABILITY[safe];
  const roll = randomFn();
  let acc = 0;
  for (const star of [3, 2, 1] as const) {
    acc += probs[star];
    if (roll < acc) return star;
  }
  return 1; // fallback defensivo
}

export type StatBlock = {
  physicalAtk: number;
  physicalDef: number;
  magicAtk: number;
  magicDef: number;
  hp: number;
  speed: number;
};

/** Multiplica todos os stats pelo multiplicador da estrela. Math.floor no fim, minimo 1. */
export function applyStarMultiplier(stats: StatBlock, stars: EncounterStars): StatBlock {
  const m = STAR_STAT_MULTIPLIER[stars];
  return {
    physicalAtk: Math.max(1, Math.floor(stats.physicalAtk * m)),
    physicalDef: Math.max(1, Math.floor(stats.physicalDef * m)),
    magicAtk: Math.max(1, Math.floor(stats.magicAtk * m)),
    magicDef: Math.max(1, Math.floor(stats.magicDef * m)),
    hp: Math.max(1, Math.floor(stats.hp * m)),
    speed: Math.max(1, Math.floor(stats.speed * m)),
  };
}
