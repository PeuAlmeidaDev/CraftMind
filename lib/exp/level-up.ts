import { LEVEL_CAP, POINTS_PER_LEVEL, HP_POINTS_MULTIPLIER } from "./constants";
import { expToNextLevel } from "./formulas";

const DISTRIBUTABLE_STATS = [
  "physicalAtk",
  "physicalDef",
  "magicAtk",
  "magicDef",
  "hp",
  "speed",
] as const;

export function processLevelUp(params: {
  level: number;
  currentExp: number;
  freePoints: number;
}): {
  levelsGained: number;
  newLevel: number;
  newExp: number;
  newFreePoints: number;
} {
  let level = params.level;
  let currentExp = params.currentExp;
  let freePoints = params.freePoints;
  let levelsGained = 0;

  while (currentExp >= expToNextLevel(level) && level < LEVEL_CAP) {
    currentExp -= expToNextLevel(level);
    level += 1;
    freePoints += POINTS_PER_LEVEL;
    levelsGained += 1;
  }

  if (level >= LEVEL_CAP) {
    currentExp = 0;
  }

  return {
    levelsGained,
    newLevel: level,
    newExp: currentExp,
    newFreePoints: freePoints,
  };
}

export function distributePoints(params: {
  freePoints: number;
  distribution: Partial<Record<string, number>>;
}): {
  valid: boolean;
  error?: string;
  remainingPoints: number;
  statChanges: Record<string, number>;
} {
  const { freePoints, distribution } = params;
  const invalidResult = (error: string) => ({
    valid: false,
    error,
    remainingPoints: freePoints,
    statChanges: {},
  });

  const entries = Object.entries(distribution);

  for (const [stat, value] of entries) {
    if (stat === "accuracy") {
      return invalidResult("accuracy nao e um stat distribuivel");
    }

    if (!(DISTRIBUTABLE_STATS as readonly string[]).includes(stat)) {
      return invalidResult(`Stat invalido: ${stat}`);
    }

    if (value === undefined || !Number.isInteger(value) || value <= 0) {
      return invalidResult(`Valor invalido para ${stat}: deve ser inteiro positivo`);
    }
  }

  const totalSpent = entries.reduce((sum, [, value]) => sum + (value ?? 0), 0);

  if (totalSpent > freePoints) {
    return invalidResult(
      `Pontos insuficientes: ${totalSpent} solicitados, ${freePoints} disponiveis`
    );
  }

  const statChanges: Record<string, number> = {};

  for (const [stat, value] of entries) {
    if (value === undefined) continue;
    if (stat === "hp") {
      statChanges["hp"] = value * HP_POINTS_MULTIPLIER;
    } else {
      statChanges[stat] = value;
    }
  }

  return {
    valid: true,
    remainingPoints: freePoints - totalSpent,
    statChanges,
  };
}
