// lib/battle/status.ts — Status effects e tick de fim de turno

import type {
  PlayerState,
  BattleState,
  TurnLogEntry,
} from "./types";
import { BURN_DAMAGE_PERCENT, POISON_SCALING } from "./constants";
import { tickEntitiesEndOfTurn } from "./shared-helpers";

export function isIncapacitated(
  player: PlayerState
): { incapacitated: boolean; reason?: "STUN" | "FROZEN" } {
  const stun = player.statusEffects.find(
    (s) => s.status === "STUN" && s.remainingTurns > 0
  );
  if (stun) {
    return { incapacitated: true, reason: "STUN" };
  }

  const frozen = player.statusEffects.find(
    (s) => s.status === "FROZEN" && s.remainingTurns > 0
  );
  if (frozen) {
    return { incapacitated: true, reason: "FROZEN" };
  }

  return { incapacitated: false };
}

export function applyStatusDamage(
  player: PlayerState,
  turnNumber: number
): TurnLogEntry[] {
  const entries: TurnLogEntry[] = [];

  for (const status of player.statusEffects) {
    if (status.status === "BURN" && status.remainingTurns > 0) {
      const damage = Math.max(
        1,
        Math.floor(player.baseStats.hp * BURN_DAMAGE_PERCENT)
      );
      player.currentHp = Math.max(0, player.currentHp - damage);
      entries.push({
        turn: turnNumber,
        phase: "STATUS_DAMAGE",
        targetId: player.playerId,
        statusDamage: damage,
        message: `${player.playerId} sofre ${damage} de dano por queimadura`,
      });
    }

    if (status.status === "POISON" && status.remainingTurns > 0) {
      const scalingIndex = Math.min(status.turnsElapsed, 2);
      const damage = Math.max(
        1,
        Math.floor(player.baseStats.hp * POISON_SCALING[scalingIndex])
      );
      player.currentHp = Math.max(0, player.currentHp - damage);
      entries.push({
        turn: turnNumber,
        phase: "STATUS_DAMAGE",
        targetId: player.playerId,
        statusDamage: damage,
        message: `${player.playerId} sofre ${damage} de dano por envenenamento`,
      });
      status.turnsElapsed += 1;
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Tick de fim de turno (delega para shared-helpers)
// ---------------------------------------------------------------------------

export function tickEndOfTurn(
  state: BattleState,
  events: TurnLogEntry[]
): void {
  tickEntitiesEndOfTurn([...state.players], state.turnNumber, events);
}
