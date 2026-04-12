export function getPlayerTier(level: number): number {
  return Math.max(1, Math.min(5, Math.ceil(level / 10)));
}

export function rollMobTier(
  playerTier: number,
  randomFn: () => number = Math.random
): number {
  const roll = randomFn();

  if (roll < 0.6) {
    return playerTier;
  }

  if (roll < 0.85) {
    return Math.max(1, playerTier - 1);
  }

  return Math.min(5, playerTier + 1);
}

export function selectRandomMob<T>(
  mobs: T[],
  randomFn: () => number = Math.random
): T {
  if (mobs.length === 0) {
    throw new Error("Lista de mobs vazia");
  }

  return mobs[Math.floor(randomFn() * mobs.length)];
}
