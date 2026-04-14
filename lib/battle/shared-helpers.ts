// lib/battle/shared-helpers.ts — Helpers compartilhados entre turn.ts e coop-turn.ts

import type {
  PlayerState,
  TurnLogEntry,
  ActiveBuff,
  ActiveStatusEffect,
  StageStat,
  BuffSource,
  CounterTriggerPayload,
  BattlePlayerConfig,
} from "./types";
import type { CoopBattlePlayerConfig } from "./coop-types";
import { clampStage, generateId } from "./utils";

// ---------------------------------------------------------------------------
// resolveTargets (shared entre effects.ts e applyCounterTriggerEffects)
// ---------------------------------------------------------------------------

export function resolveTargetsPvP(
  effectTarget: string,
  caster: PlayerState,
  opponent: PlayerState
): PlayerState[] {
  switch (effectTarget) {
    case "SELF":
    case "SINGLE_ALLY":
    case "ALL_ALLIES":
      return [caster];
    case "SINGLE_ENEMY":
    case "ALL_ENEMIES":
      return [opponent];
    case "ALL":
      return [caster, opponent];
    default:
      return [opponent];
  }
}

// ---------------------------------------------------------------------------
// isStageStat
// ---------------------------------------------------------------------------

const STAGE_STATS = new Set<string>([
  "physicalAtk",
  "physicalDef",
  "magicAtk",
  "magicDef",
  "speed",
  "accuracy",
]);

export function isStageStat(stat: string): stat is StageStat {
  return STAGE_STATS.has(stat);
}

// ---------------------------------------------------------------------------
// createPlayerState (usado por init.ts e coop-turn.ts)
// ---------------------------------------------------------------------------

export function createPlayerState(
  config: BattlePlayerConfig | CoopBattlePlayerConfig
): PlayerState {
  if (config.skills.length < 1 || config.skills.length > 4) {
    throw new Error(
      `Jogador ${config.userId} deve ter entre 1 e 4 skills equipadas (tem ${config.skills.length})`
    );
  }

  return {
    playerId: config.userId,
    characterId: config.characterId,
    baseStats: config.stats,
    currentHp: config.stats.hp,
    stages: {
      physicalAtk: 0,
      physicalDef: 0,
      magicAtk: 0,
      magicDef: 0,
      speed: 0,
      accuracy: 0,
    },
    statusEffects: [],
    buffs: [],
    vulnerabilities: [],
    counters: [],
    cooldowns: {},
    combo: { skillId: null, stacks: 0 },
    equippedSkills: config.skills,
  };
}

// ---------------------------------------------------------------------------
// applyCounterTriggerEffects
// ---------------------------------------------------------------------------

export function applyCounterTriggerEffects(
  triggers: CounterTriggerPayload[],
  counterer: PlayerState,
  attacker: PlayerState,
  turnNumber: number,
  events: TurnLogEntry[],
  randomFn?: () => number
): void {
  for (const trigger of triggers) {
    const targets = resolveTargetsPvP(trigger.target, counterer, attacker);

    for (const target of targets) {
      switch (trigger.type) {
        case "BUFF": {
          if (trigger.chance !== undefined && (randomFn ?? Math.random)() * 100 >= trigger.chance) break;
          const buff: ActiveBuff = {
            id: generateId(),
            source: "BUFF" as BuffSource,
            stat: trigger.stat as StageStat | "priority",
            value: trigger.value,
            remainingTurns: trigger.duration + 1,
          };
          if (isStageStat(trigger.stat)) {
            target.stages[trigger.stat] = clampStage(target.stages[trigger.stat] + trigger.value);
          }
          target.buffs.push(buff);
          events.push({
            turn: turnNumber,
            phase: "COUNTER_TRIGGER",
            targetId: target.playerId,
            buffApplied: { stat: trigger.stat, value: trigger.value, duration: trigger.duration },
            message: `Contra-ataque: ${target.playerId} recebe buff de ${trigger.stat} +${trigger.value}`,
          });
          break;
        }
        case "DEBUFF": {
          if (trigger.chance !== undefined && (randomFn ?? Math.random)() * 100 >= trigger.chance) break;
          const debuff: ActiveBuff = {
            id: generateId(),
            source: "DEBUFF" as BuffSource,
            stat: trigger.stat as StageStat | "priority",
            value: trigger.value,
            remainingTurns: trigger.duration + 1,
          };
          if (isStageStat(trigger.stat)) {
            target.stages[trigger.stat] = clampStage(target.stages[trigger.stat] - trigger.value);
          }
          target.buffs.push(debuff);
          events.push({
            turn: turnNumber,
            phase: "COUNTER_TRIGGER",
            targetId: target.playerId,
            debuffApplied: { stat: trigger.stat, value: trigger.value, duration: trigger.duration },
            message: `Contra-ataque: ${target.playerId} recebe debuff de ${trigger.stat} -${trigger.value}`,
          });
          break;
        }
        case "STATUS": {
          if ((randomFn ?? Math.random)() * 100 >= trigger.chance) break;
          const existing = target.statusEffects.find((s) => s.status === trigger.status);
          if (existing) {
            existing.remainingTurns = trigger.duration + 1;
            existing.turnsElapsed = 0;
          } else {
            const newStatus: ActiveStatusEffect = {
              status: trigger.status,
              remainingTurns: trigger.duration + 1,
              turnsElapsed: 0,
            };
            target.statusEffects.push(newStatus);
            if (trigger.status === "SLOW") {
              target.stages.speed = clampStage(target.stages.speed - 2);
            }
            if (trigger.status === "BURN") {
              target.stages.physicalAtk = clampStage(target.stages.physicalAtk - 1);
            }
          }
          events.push({
            turn: turnNumber,
            phase: "COUNTER_TRIGGER",
            targetId: target.playerId,
            statusApplied: trigger.status,
            message: `Contra-ataque: ${target.playerId} recebe status ${trigger.status}`,
          });
          break;
        }
        case "VULNERABILITY": {
          if (trigger.chance !== undefined && (randomFn ?? Math.random)() * 100 >= trigger.chance) break;
          target.vulnerabilities.push({
            id: generateId(),
            damageType: trigger.damageType,
            percent: trigger.percent,
            remainingTurns: trigger.duration + 1,
          });
          events.push({
            turn: turnNumber,
            phase: "COUNTER_TRIGGER",
            targetId: target.playerId,
            message: `Contra-ataque: ${target.playerId} fica vulneravel a ${trigger.damageType} (+${trigger.percent}%)`,
          });
          break;
        }
        case "HEAL": {
          const healAmount = Math.floor(target.baseStats.hp * (trigger.percent / 100));
          target.currentHp = Math.min(target.baseStats.hp, target.currentHp + healAmount);
          events.push({
            turn: turnNumber,
            phase: "COUNTER_TRIGGER",
            targetId: target.playerId,
            healing: healAmount,
            message: `Contra-ataque: ${target.playerId} recupera ${healAmount} HP`,
          });
          break;
        }
        case "SELF_DEBUFF": {
          const selfDebuff: ActiveBuff = {
            id: generateId(),
            source: "DEBUFF" as BuffSource,
            stat: trigger.stat as StageStat | "priority",
            value: trigger.value,
            remainingTurns: trigger.duration + 1,
          };
          if (isStageStat(trigger.stat)) {
            counterer.stages[trigger.stat] = clampStage(counterer.stages[trigger.stat] - trigger.value);
          }
          counterer.buffs.push(selfDebuff);
          events.push({
            turn: turnNumber,
            phase: "COUNTER_TRIGGER",
            targetId: counterer.playerId,
            debuffApplied: { stat: trigger.stat, value: trigger.value, duration: trigger.duration },
            message: `Contra-ataque: ${counterer.playerId} sofre auto-debuff de ${trigger.stat} -${trigger.value}`,
          });
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// applyOnExpireEffect
// ---------------------------------------------------------------------------

export function applyOnExpireEffect(
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
// tickEntitiesEndOfTurn (shared logic for tickEndOfTurn / tickCoopEndOfTurn)
// ---------------------------------------------------------------------------

export function tickEntitiesEndOfTurn(
  entities: PlayerState[],
  turnNumber: number,
  events: TurnLogEntry[]
): void {
  for (const player of entities) {
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
