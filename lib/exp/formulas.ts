import { BASE_EXP_REQUIRED, EXP_GROWTH_RATE } from "./constants";

export function expToNextLevel(level: number): number {
  return Math.floor(BASE_EXP_REQUIRED * Math.pow(EXP_GROWTH_RATE, level - 1));
}

export function calculateMobExp(mob: {
  physicalAtk: number;
  physicalDef: number;
  magicAtk: number;
  magicDef: number;
  hp: number;
  speed: number;
}): number {
  return Math.floor(
    (mob.physicalAtk +
      mob.physicalDef +
      mob.magicAtk +
      mob.magicDef +
      mob.hp / 10 +
      mob.speed) /
      6
  );
}

export function calculateExpGained(
  baseExp: number,
  playerLevel: number,
  mobTier: number
): number {
  const mobExpectedLevel = mobTier * 10;
  const levelDiff = playerLevel - mobExpectedLevel;

  if (levelDiff <= 0) {
    return baseExp;
  }

  const multiplier = Math.max(0.1, 1 - levelDiff * 0.05);
  return Math.max(1, Math.floor(baseExp * multiplier));
}

/**
 * Calcula EXP ganho em vitoria PvP.
 * Base: 50 EXP + bonus por diferenca de nivel.
 * Vencer oponente mais forte da mais EXP. Perder: 0. Empate: metade.
 */
export function calculatePvpExpGained(
  result: "VICTORY" | "DEFEAT" | "DRAW",
  playerLevel: number,
  opponentLevel: number
): number {
  if (result === "DEFEAT") return 0;

  const BASE_PVP_EXP = 50;
  const levelDiff = opponentLevel - playerLevel;
  const multiplier = Math.max(0.5, 1 + levelDiff * 0.1);
  const exp = Math.floor(BASE_PVP_EXP * multiplier);

  if (result === "DRAW") return Math.max(1, Math.floor(exp / 2));
  return Math.max(1, exp);
}
