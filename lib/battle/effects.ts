// lib/battle/effects.ts — Aplicacao de efeitos de skill

import type {
  Skill,
  SkillEffect,
  BattleState,
  PlayerState,
  TurnLogEntry,
  ActiveBuff,
  ActiveStatusEffect,
  ActiveVulnerability,
  ActiveCounter,
  StageStat,
  BuffSource,
  OnExpirePayload,
} from "./types";
import { clampStage, getPlayer, getOpponent, generateId } from "./utils";
import { isStageStat, resolveTargetsPvP } from "./shared-helpers";

// ---------------------------------------------------------------------------
// Aplicacao de efeitos individuais
// ---------------------------------------------------------------------------

function applyBuff(
  effect: Extract<SkillEffect, { type: "BUFF" }>,
  target: PlayerState,
  turnNumber: number,
  onExpire?: OnExpirePayload,
  randomFn?: () => number
): TurnLogEntry | null {
  if (effect.chance !== undefined && (randomFn ?? Math.random)() * 100 >= effect.chance) {
    return null;
  }

  const buff: ActiveBuff = {
    id: generateId(),
    source: "BUFF" as BuffSource,
    stat: effect.stat as StageStat | "priority",
    value: effect.value,
    // +1 para compensar o tickEndOfTurn que decrementa no fim do mesmo turno
    remainingTurns: effect.duration + 1,
    ...(onExpire ? { onExpire } : {}),
  };

  if (isStageStat(effect.stat)) {
    target.stages[effect.stat] = clampStage(
      target.stages[effect.stat] + effect.value
    );
  }

  target.buffs.push(buff);

  return {
    turn: turnNumber,
    phase: "EFFECT",
    targetId: target.playerId,
    buffApplied: {
      stat: effect.stat,
      value: effect.value,
      duration: effect.duration,
    },
    message: `${target.playerId} recebe buff de ${effect.stat} +${effect.value} por ${effect.duration} turnos`,
  };
}

function applyDebuff(
  effect: Extract<SkillEffect, { type: "DEBUFF" }>,
  target: PlayerState,
  turnNumber: number,
  onExpire?: OnExpirePayload,
  randomFn?: () => number
): TurnLogEntry | null {
  if (effect.chance !== undefined && (randomFn ?? Math.random)() * 100 >= effect.chance) {
    return null;
  }

  const buff: ActiveBuff = {
    id: generateId(),
    source: "DEBUFF" as BuffSource,
    stat: effect.stat as StageStat | "priority",
    value: effect.value,
    // +1 para compensar o tickEndOfTurn que decrementa no fim do mesmo turno
    remainingTurns: effect.duration + 1,
    ...(onExpire ? { onExpire } : {}),
  };

  if (isStageStat(effect.stat)) {
    target.stages[effect.stat] = clampStage(
      target.stages[effect.stat] - effect.value
    );
  }

  target.buffs.push(buff);

  return {
    turn: turnNumber,
    phase: "EFFECT",
    targetId: target.playerId,
    debuffApplied: {
      stat: effect.stat,
      value: effect.value,
      duration: effect.duration,
    },
    message: `${target.playerId} recebe debuff de ${effect.stat} -${effect.value} por ${effect.duration} turnos`,
  };
}

function applyStatus(
  effect: Extract<SkillEffect, { type: "STATUS" }>,
  target: PlayerState,
  turnNumber: number,
  randomFn?: () => number
): TurnLogEntry | null {
  if ((randomFn ?? Math.random)() * 100 >= effect.chance) {
    return null;
  }

  const existing = target.statusEffects.find(
    (s) => s.status === effect.status
  );
  if (existing) {
    // +1 para compensar o tickEndOfTurn que decrementa no fim do mesmo turno
    existing.remainingTurns = effect.duration + 1;
    existing.turnsElapsed = 0;
  } else {
    const newStatus: ActiveStatusEffect = {
      status: effect.status,
      // +1 para compensar o tickEndOfTurn que decrementa no fim do mesmo turno
      remainingTurns: effect.duration + 1,
      turnsElapsed: 0,
    };
    target.statusEffects.push(newStatus);

    if (effect.status === "SLOW") {
      target.stages.speed = clampStage(target.stages.speed - 2);
    }
    if (effect.status === "BURN") {
      target.stages.physicalAtk = clampStage(target.stages.physicalAtk - 1);
    }
  }

  return {
    turn: turnNumber,
    phase: "EFFECT",
    targetId: target.playerId,
    statusApplied: effect.status,
    message: `${target.playerId} recebe status ${effect.status} por ${effect.duration} turnos`,
  };
}

function applyVulnerability(
  effect: Extract<SkillEffect, { type: "VULNERABILITY" }>,
  target: PlayerState,
  turnNumber: number,
  randomFn?: () => number
): TurnLogEntry | null {
  if (effect.chance !== undefined && (randomFn ?? Math.random)() * 100 >= effect.chance) {
    return null;
  }

  const vuln: ActiveVulnerability = {
    id: generateId(),
    damageType: effect.damageType,
    percent: effect.percent,
    // +1 para compensar o tickEndOfTurn que decrementa no fim do mesmo turno
    remainingTurns: effect.duration + 1,
  };
  target.vulnerabilities.push(vuln);

  return {
    turn: turnNumber,
    phase: "EFFECT",
    targetId: target.playerId,
    message: `${target.playerId} fica vulneravel a dano ${effect.damageType} (+${effect.percent}%) por ${effect.duration} turnos`,
  };
}

function applyPriorityShift(
  effect: Extract<SkillEffect, { type: "PRIORITY_SHIFT" }>,
  target: PlayerState,
  turnNumber: number
): TurnLogEntry {
  const buff: ActiveBuff = {
    id: generateId(),
    source: "PRIORITY_SHIFT" as BuffSource,
    stat: "priority",
    value: effect.stages,
    // +1 para compensar o tickEndOfTurn que decrementa no fim do mesmo turno
    remainingTurns: effect.duration + 1,
  };
  target.buffs.push(buff);

  return {
    turn: turnNumber,
    phase: "EFFECT",
    targetId: target.playerId,
    message: `${target.playerId} recebe modificador de prioridade ${effect.stages > 0 ? "+" : ""}${effect.stages} por ${effect.duration} turnos`,
  };
}

function applyCounter(
  effect: Extract<SkillEffect, { type: "COUNTER" }>,
  target: PlayerState,
  turnNumber: number
): TurnLogEntry {
  const counter: ActiveCounter = {
    id: generateId(),
    powerMultiplier: effect.powerMultiplier,
    // +1 para compensar o tickEndOfTurn que decrementa no fim do mesmo turno
    remainingTurns: effect.duration + 1,
    ...(effect.onTrigger ? { onTrigger: effect.onTrigger } : {}),
  };
  target.counters.push(counter);

  return {
    turn: turnNumber,
    phase: "EFFECT",
    targetId: target.playerId,
    counterTriggered: false,
    message: `${target.playerId} prepara contra-ataque (${effect.powerMultiplier}x) por ${effect.duration} turnos`,
  };
}

function applyHeal(
  effect: Extract<SkillEffect, { type: "HEAL" }>,
  target: PlayerState,
  turnNumber: number
): TurnLogEntry {
  const healAmount = Math.floor(target.baseStats.hp * (effect.percent / 100));
  target.currentHp = Math.min(target.baseStats.hp, target.currentHp + healAmount);

  return {
    turn: turnNumber,
    phase: "EFFECT",
    targetId: target.playerId,
    healing: healAmount,
    message: `${target.playerId} recupera ${healAmount} HP`,
  };
}

function applyCleanse(
  effect: Extract<SkillEffect, { type: "CLEANSE" }>,
  target: PlayerState,
  turnNumber: number
): TurnLogEntry {
  const cleansedEffects: string[] = [];

  if (effect.targets === "DEBUFFS" || effect.targets === "ALL") {
    const debuffs = target.buffs.filter((b) => b.source === "DEBUFF");
    for (const debuff of debuffs) {
      if (isStageStat(debuff.stat)) {
        target.stages[debuff.stat] = clampStage(
          target.stages[debuff.stat] + debuff.value
        );
      }
      cleansedEffects.push(`debuff ${debuff.stat}`);
    }
    target.buffs = target.buffs.filter((b) => b.source !== "DEBUFF");
  }

  if (effect.targets === "STATUS" || effect.targets === "ALL") {
    for (const status of target.statusEffects) {
      if (status.status === "SLOW") {
        target.stages.speed = clampStage(target.stages.speed + 2);
      }
      if (status.status === "BURN") {
        target.stages.physicalAtk = clampStage(target.stages.physicalAtk + 1);
      }
      cleansedEffects.push(`status ${status.status}`);
    }
    target.statusEffects = [];
  }

  return {
    turn: turnNumber,
    phase: "EFFECT",
    targetId: target.playerId,
    message: `${target.playerId} limpa efeitos negativos: ${cleansedEffects.length > 0 ? cleansedEffects.join(", ") : "nenhum"}`,
  };
}

function applyRecoil(
  effect: Extract<SkillEffect, { type: "RECOIL" }>,
  caster: PlayerState,
  totalDamage: number,
  turnNumber: number
): TurnLogEntry {
  // Sem dano causado = sem recuo (evita dano fantasma de 1 HP)
  const recoilDamage = totalDamage > 0
    ? Math.max(1, Math.floor(totalDamage * (effect.percentOfDamage / 100)))
    : 0;
  caster.currentHp = Math.max(0, caster.currentHp - recoilDamage);

  return {
    turn: turnNumber,
    phase: "EFFECT",
    actorId: caster.playerId,
    targetId: caster.playerId,
    damage: recoilDamage,
    message: `${caster.playerId} sofre ${recoilDamage} de dano de recuo`,
  };
}

function applySelfDebuff(
  effect: Extract<SkillEffect, { type: "SELF_DEBUFF" }>,
  caster: PlayerState,
  turnNumber: number
): TurnLogEntry {
  const buff: ActiveBuff = {
    id: generateId(),
    source: "DEBUFF" as BuffSource,
    stat: effect.stat as StageStat | "priority",
    value: effect.value,
    // +1 para compensar o tickEndOfTurn que decrementa no fim do mesmo turno
    remainingTurns: effect.duration + 1,
  };

  if (isStageStat(effect.stat)) {
    caster.stages[effect.stat] = clampStage(
      caster.stages[effect.stat] - effect.value
    );
  }

  caster.buffs.push(buff);

  return {
    turn: turnNumber,
    phase: "EFFECT",
    actorId: caster.playerId,
    targetId: caster.playerId,
    debuffApplied: {
      stat: effect.stat,
      value: effect.value,
      duration: effect.duration,
    },
    message: `${caster.playerId} sofre auto-debuff de ${effect.stat} -${effect.value} por ${effect.duration} turnos`,
  };
}

function applyOnExpire(
  effect: Extract<SkillEffect, { type: "ON_EXPIRE" }>,
  target: PlayerState,
  turnNumber: number,
  randomFn?: () => number
): TurnLogEntry | null {
  const trigger = effect.trigger;

  // Criar o buff/debuff monitorado (trigger) com o campo onExpire
  if (trigger.type === "BUFF") {
    return applyBuff(trigger, target, turnNumber, effect.effect, randomFn);
  } else {
    return applyDebuff(trigger, target, turnNumber, effect.effect, randomFn);
  }
}

// ---------------------------------------------------------------------------
// Dispatcher principal
// ---------------------------------------------------------------------------

export function applyEffects(params: {
  skill: Skill;
  casterId: string;
  state: BattleState;
  totalDamage: number;
  turnNumber: number;
  randomFn?: () => number;
}): TurnLogEntry[] {
  const { skill, casterId, state, totalDamage, turnNumber, randomFn } = params;
  const caster = getPlayer(state, casterId);
  const opponent = getOpponent(state, casterId);
  const entries: TurnLogEntry[] = [];

  for (const effect of skill.effects) {
    // COMBO ja tratado no turn.ts
    if (effect.type === "COMBO") continue;

    switch (effect.type) {
      case "BUFF": {
        const targets = resolveTargetsPvP(effect.target, caster, opponent);
        for (const target of targets) {
          const entry = applyBuff(effect, target, turnNumber, undefined, randomFn);
          if (entry) entries.push(entry);
        }
        break;
      }

      case "DEBUFF": {
        const targets = resolveTargetsPvP(effect.target, caster, opponent);
        for (const target of targets) {
          const entry = applyDebuff(effect, target, turnNumber, undefined, randomFn);
          if (entry) entries.push(entry);
        }
        break;
      }

      case "STATUS": {
        const targets = resolveTargetsPvP(effect.target, caster, opponent);
        for (const target of targets) {
          const entry = applyStatus(effect, target, turnNumber, randomFn);
          if (entry) entries.push(entry);
        }
        break;
      }

      case "VULNERABILITY": {
        const targets = resolveTargetsPvP(effect.target, caster, opponent);
        for (const target of targets) {
          const entry = applyVulnerability(effect, target, turnNumber, randomFn);
          if (entry) entries.push(entry);
        }
        break;
      }

      case "PRIORITY_SHIFT": {
        const targets = resolveTargetsPvP(effect.target, caster, opponent);
        for (const target of targets) {
          entries.push(applyPriorityShift(effect, target, turnNumber));
        }
        break;
      }

      case "COUNTER": {
        const targets = resolveTargetsPvP(effect.target, caster, opponent);
        for (const target of targets) {
          entries.push(applyCounter(effect, target, turnNumber));
        }
        break;
      }

      case "HEAL": {
        const targets = resolveTargetsPvP(effect.target, caster, opponent);
        for (const target of targets) {
          entries.push(applyHeal(effect, target, turnNumber));
        }
        break;
      }

      case "CLEANSE": {
        const targets = resolveTargetsPvP(effect.target, caster, opponent);
        for (const target of targets) {
          entries.push(applyCleanse(effect, target, turnNumber));
        }
        break;
      }

      case "RECOIL": {
        entries.push(applyRecoil(effect, caster, totalDamage, turnNumber));
        break;
      }

      case "SELF_DEBUFF": {
        entries.push(applySelfDebuff(effect, caster, turnNumber));
        break;
      }

      case "ON_EXPIRE": {
        const targets = resolveTargetsPvP(effect.trigger.target, caster, opponent);
        for (const target of targets) {
          const entry = applyOnExpire(effect, target, turnNumber, randomFn);
          if (entry) entries.push(entry);
        }
        break;
      }
    }
  }

  return entries;
}
