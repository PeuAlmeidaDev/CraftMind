// lib/battle/status.ts — Status effects e tick de fim de turno

import type {
  PlayerState,
  BattleState,
  TurnLogEntry,
  ActiveBuff,
  ActiveStatusEffect,
  StageStat,
  StatusEffect,
} from "./types";
import { clampStage } from "./utils";
import { BURN_DAMAGE_PERCENT, POISON_SCALING } from "./constants";

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
// Helpers internos para aplicar efeitos de ON_EXPIRE
// ---------------------------------------------------------------------------

function applyOnExpireEffect(
  buff: ActiveBuff,
  player: PlayerState,
  turnNumber: number,
  events: TurnLogEntry[]
): void {
  if (!buff.onExpire) return;

  const effect = buff.onExpire;

  if (effect.type === "BUFF") {
    const stat = effect.stat;
    if (stat !== "hp") {
      player.stages[stat as StageStat] = clampStage(
        player.stages[stat as StageStat] + effect.value
      );
    }
    events.push({
      turn: turnNumber,
      phase: "ON_EXPIRE",
      targetId: player.playerId,
      buffApplied: { stat, value: effect.value, duration: effect.duration },
      message: `Efeito expirado: buff de ${stat} +${effect.value} aplicado em ${player.playerId}`,
    });
  } else if (effect.type === "DEBUFF") {
    const stat = effect.stat;
    if (stat !== "hp") {
      player.stages[stat as StageStat] = clampStage(
        player.stages[stat as StageStat] - effect.value
      );
    }
    events.push({
      turn: turnNumber,
      phase: "ON_EXPIRE",
      targetId: player.playerId,
      debuffApplied: { stat, value: effect.value, duration: effect.duration },
      message: `Efeito expirado: debuff de ${stat} -${effect.value} aplicado em ${player.playerId}`,
    });
  } else if (effect.type === "STATUS") {
    const existing = player.statusEffects.find(
      (s) => s.status === effect.status
    );
    if (existing) {
      existing.remainingTurns = effect.duration;
      existing.turnsElapsed = 0;
    } else {
      const newStatus: ActiveStatusEffect = {
        status: effect.status,
        remainingTurns: effect.duration,
        turnsElapsed: 0,
      };
      player.statusEffects.push(newStatus);
      if (effect.status === "SLOW") {
        player.stages.speed = clampStage(player.stages.speed - 2);
      }
      if (effect.status === "BURN") {
        player.stages.physicalAtk = clampStage(player.stages.physicalAtk - 1);
      }
    }
    events.push({
      turn: turnNumber,
      phase: "ON_EXPIRE",
      targetId: player.playerId,
      statusApplied: effect.status,
      message: `Efeito expirado: status ${effect.status} aplicado em ${player.playerId}`,
    });
  } else if (effect.type === "HEAL") {
    const healAmount = Math.floor(player.baseStats.hp * (effect.percent / 100));
    player.currentHp = Math.min(
      player.baseStats.hp,
      player.currentHp + healAmount
    );
    events.push({
      turn: turnNumber,
      phase: "ON_EXPIRE",
      targetId: player.playerId,
      healing: healAmount,
      message: `Efeito expirado: ${player.playerId} recupera ${healAmount} HP`,
    });
  } else if (effect.type === "RECOIL") {
    const recoilDamage = Math.max(
      1,
      Math.floor(player.baseStats.hp * (effect.percentOfDamage / 100))
    );
    player.currentHp = Math.max(0, player.currentHp - recoilDamage);
    events.push({
      turn: turnNumber,
      phase: "ON_EXPIRE",
      targetId: player.playerId,
      damage: recoilDamage,
      message: `Efeito expirado: ${player.playerId} sofre ${recoilDamage} de recuo`,
    });
  }
}

// ---------------------------------------------------------------------------
// Tick de fim de turno
// ---------------------------------------------------------------------------

export function tickEndOfTurn(
  state: BattleState,
  events: TurnLogEntry[]
): void {
  const turnNumber = state.turnNumber;

  for (const player of state.players) {
    if (player.currentHp <= 0) continue;

    // 1. Status effects
    const expiredStatuses: ActiveStatusEffect[] = [];
    for (const status of player.statusEffects) {
      status.remainingTurns -= 1;
      if (status.remainingTurns <= 0) {
        expiredStatuses.push(status);
      }
    }
    for (const expired of expiredStatuses) {
      if (expired.status === "SLOW") {
        player.stages.speed = clampStage(player.stages.speed + 2);
      }
      if (expired.status === "BURN") {
        player.stages.physicalAtk = clampStage(player.stages.physicalAtk + 1);
      }
      events.push({
        turn: turnNumber,
        phase: "STATUS_EXPIRE",
        targetId: player.playerId,
        message: `Status ${expired.status} expirou em ${player.playerId}`,
      });
    }
    player.statusEffects = player.statusEffects.filter(
      (s) => s.remainingTurns > 0
    );

    // 2. Buffs
    const expiredBuffs: ActiveBuff[] = [];
    for (const buff of player.buffs) {
      buff.remainingTurns -= 1;
      if (buff.remainingTurns <= 0) {
        expiredBuffs.push(buff);
      }
    }
    for (const buff of expiredBuffs) {
      // Reverter stage changes
      if (buff.stat !== "priority") {
        const stageStat = buff.stat as StageStat;
        if (buff.source === "BUFF" || buff.source === "PRIORITY_SHIFT") {
          player.stages[stageStat] = clampStage(
            player.stages[stageStat] - buff.value
          );
        } else if (buff.source === "DEBUFF") {
          player.stages[stageStat] = clampStage(
            player.stages[stageStat] + buff.value
          );
        }
      }

      events.push({
        turn: turnNumber,
        phase: "BUFF_EXPIRE",
        targetId: player.playerId,
        message: `${buff.source} de ${buff.stat} (${buff.value}) expirou em ${player.playerId}`,
      });

      // Aplicar ON_EXPIRE se existir
      if (buff.onExpire) {
        applyOnExpireEffect(buff, player, turnNumber, events);
      }
    }
    player.buffs = player.buffs.filter((b) => b.remainingTurns > 0);

    // 3. Vulnerabilities
    player.vulnerabilities = player.vulnerabilities.filter((v) => {
      v.remainingTurns -= 1;
      return v.remainingTurns > 0;
    });

    // 4. Counters
    player.counters = player.counters.filter((c) => {
      c.remainingTurns -= 1;
      return c.remainingTurns > 0;
    });
  }
}
