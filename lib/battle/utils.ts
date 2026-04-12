// lib/battle/utils.ts — Funcoes utilitarias puras

import type { BattleState, PlayerState } from "./types";
import { MIN_STAGE, MAX_STAGE, RANDOM_MIN, RANDOM_MAX } from "./constants";

export function clampStage(value: number): number {
  return Math.max(MIN_STAGE, Math.min(MAX_STAGE, value));
}

export function randomMultiplier(randomFn?: () => number): number {
  return RANDOM_MIN + (randomFn ?? Math.random)() * (RANDOM_MAX - RANDOM_MIN);
}

export function getPlayer(state: BattleState, playerId: string): PlayerState {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) {
    throw new Error(`Jogador ${playerId} nao encontrado na batalha`);
  }
  return player;
}

export function getOpponent(state: BattleState, playerId: string): PlayerState {
  const opponent = state.players.find((p) => p.playerId !== playerId);
  if (!opponent) {
    throw new Error(`Oponente de ${playerId} nao encontrado na batalha`);
  }
  return opponent;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function deepClone<T>(obj: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj)) as T;
}
