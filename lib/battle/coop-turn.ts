// lib/battle/coop-turn.ts — Orquestrador de turno para batalha cooperativa (Boss Fight 3v1)

import type {
  BattleState,
  TurnLogEntry,
  PlayerState,
  Skill,
  ActiveBuff,
  ActiveStatusEffect,
  StageStat,
  BuffSource,
  CounterTriggerPayload,
} from "./types";
import type {
  CoopBattleState,
  CoopTurnAction,
  CoopTurnResult,
  CoopBossBattleConfig,
  CoopBattlePlayerConfig,
} from "./coop-types";
import { deepClone, generateId, clampStage } from "./utils";
import { getEffectiveStat, calculateDamage } from "./damage";
import { getComboModifier, putOnCooldown, tickCooldowns } from "./skills";
import { isIncapacitated, applyStatusDamage } from "./status";
import { applyEffects } from "./effects";
import { chooseAction } from "./ai";
import { chooseBossTarget, resolveCoopTargets } from "./coop-target";
import { MAX_TURNS, STAGE_MULTIPLIERS } from "./constants";

// ---------------------------------------------------------------------------
// Helper: criar PlayerState a partir de config (replica createPlayerState de init.ts)
// ---------------------------------------------------------------------------

function createPlayerState(config: CoopBattlePlayerConfig): PlayerState {
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
// Helper: isStageStat
// ---------------------------------------------------------------------------

function isStageStat(stat: string): stat is StageStat {
  return ["physicalAtk", "physicalDef", "magicAtk", "magicDef", "speed", "accuracy"].includes(stat);
}

// ---------------------------------------------------------------------------
// Helper: applyCounterTriggerEffects (replica de turn.ts, nao exportada la)
// ---------------------------------------------------------------------------

function applyCounterTriggerEffects(
  triggers: CounterTriggerPayload[],
  counterer: PlayerState,
  attacker: PlayerState,
  turnNumber: number,
  events: TurnLogEntry[],
  randomFn?: () => number
): void {
  for (const trigger of triggers) {
    let targets: PlayerState[];
    switch (trigger.target) {
      case "SELF":
      case "SINGLE_ALLY":
      case "ALL_ALLIES":
        targets = [counterer];
        break;
      case "SINGLE_ENEMY":
      case "ALL_ENEMIES":
        targets = [attacker];
        break;
      case "ALL":
        targets = [counterer, attacker];
        break;
      default:
        targets = [attacker];
    }

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
// Helper: tickCoopEndOfTurn (replica tickEndOfTurn para [boss, ...team])
// ---------------------------------------------------------------------------

function tickCoopEndOfTurn(
  state: CoopBattleState,
  events: TurnLogEntry[]
): void {
  const turnNumber = state.turnNumber;
  const allEntities = [state.boss, ...state.team];

  for (const player of allEntities) {
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

// ---------------------------------------------------------------------------
// Helper: applyOnExpireEffect (replica de status.ts, nao exportada la)
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
// Helper: encontrar entidade no estado coop por playerId
// ---------------------------------------------------------------------------

function findEntity(state: CoopBattleState, playerId: string): PlayerState | undefined {
  if (state.boss.playerId === playerId) return state.boss;
  return state.team.find((p) => p.playerId === playerId);
}

// ---------------------------------------------------------------------------
// Helper: criar BattleState fake para adaptar funcoes existentes
// ---------------------------------------------------------------------------

function makeFakeBattleState(
  entity1: PlayerState,
  entity2: PlayerState,
  battleId: string,
  turnNumber: number
): BattleState {
  return {
    battleId,
    turnNumber,
    players: [entity1, entity2] as [PlayerState, PlayerState],
    turnLog: [],
    status: "IN_PROGRESS",
    winnerId: null,
  };
}

// ---------------------------------------------------------------------------
// Helper: checar fim de batalha cooperativa
// ---------------------------------------------------------------------------

function checkCoopBattleEnd(
  state: CoopBattleState,
  events: TurnLogEntry[]
): void {
  if (state.status === "FINISHED") return;

  if (state.boss.currentHp <= 0) {
    state.status = "FINISHED";
    state.winnerId = "team";
    events.push({
      turn: state.turnNumber,
      phase: "DEATH",
      targetId: state.boss.playerId,
      message: `Boss ${state.boss.playerId} foi derrotado! O time vence!`,
    });
    return;
  }

  const allTeamDead = state.team.every((p) => p.currentHp <= 0);
  if (allTeamDead) {
    state.status = "FINISHED";
    state.winnerId = null;
    events.push({
      turn: state.turnNumber,
      phase: "DEATH",
      message: `Todo o time foi derrotado. O boss vence.`,
    });
  }
}

// ---------------------------------------------------------------------------
// initCoopBattle
// ---------------------------------------------------------------------------

export function initCoopBattle(config: CoopBossBattleConfig): CoopBattleState {
  if (config.team.length !== 3) {
    throw new Error(
      `Batalha cooperativa requer exatamente 3 jogadores no time (recebeu ${config.team.length})`
    );
  }

  const teamStates = config.team.map((p) => createPlayerState(p));
  const bossState = createPlayerState(config.boss);

  return {
    battleId: config.battleId,
    turnNumber: 1,
    team: teamStates,
    boss: bossState,
    turnLog: [],
    status: "IN_PROGRESS",
    winnerId: null,
  };
}

// ---------------------------------------------------------------------------
// resolveCoopTurn
// ---------------------------------------------------------------------------

export function resolveCoopTurn(
  state: CoopBattleState,
  teamActions: CoopTurnAction[],
  randomFn?: () => number
): CoopTurnResult {
  // 0. Guard: batalha ja finalizada
  if (state.status === "FINISHED") {
    return { state, events: [] };
  }

  // 1. Deep clone
  const clonedState = deepClone(state);
  const events: TurnLogEntry[] = [];

  // 2. Validar acoes do time
  if (teamActions.length !== 3) {
    throw new Error(
      `Batalha cooperativa requer exatamente 3 acoes (recebeu ${teamActions.length})`
    );
  }

  const teamPlayerIds = new Set(clonedState.team.map((p) => p.playerId));
  const actionPlayerIds = new Set(teamActions.map((a) => a.playerId));

  if (actionPlayerIds.size !== 3) {
    throw new Error("Acoes duplicadas: cada jogador deve enviar exatamente 1 acao");
  }

  for (const action of teamActions) {
    if (!teamPlayerIds.has(action.playerId)) {
      throw new Error(
        `PlayerId ${action.playerId} nao pertence ao time da batalha`
      );
    }
  }

  // 3. Gerar acao do boss via IA
  const aliveTeam = clonedState.team.filter((p) => p.currentHp > 0);
  let bossAction: { playerId: string; skillId: string | null };

  if (aliveTeam.length === 0) {
    bossAction = { playerId: clonedState.boss.playerId, skillId: null };
  } else {
    const targetPlayerId = chooseBossTarget(aliveTeam, randomFn);
    const targetPlayer = aliveTeam.find((p) => p.playerId === targetPlayerId);

    if (!targetPlayer) {
      bossAction = { playerId: clonedState.boss.playerId, skillId: null };
    } else {
      const fakeBattleState = makeFakeBattleState(
        clonedState.boss,
        targetPlayer,
        clonedState.battleId,
        clonedState.turnNumber
      );

      const aiAction = chooseAction({
        state: fakeBattleState,
        mobPlayerId: clonedState.boss.playerId,
        profile: "BALANCED",
        randomFn,
      });

      bossAction = { playerId: aiAction.playerId, skillId: aiAction.skillId };
    }
  }

  // 4. Montar 4 acoes (3 players + boss)
  type InternalAction = {
    playerId: string;
    skillId: string | null;
    targetId?: string;
    side: "team" | "boss";
  };

  const allActions: InternalAction[] = [
    ...teamActions.map((a) => ({
      playerId: a.playerId,
      skillId: a.skillId,
      targetId: a.targetId,
      side: "team" as const,
    })),
    {
      playerId: bossAction.playerId,
      skillId: bossAction.skillId,
      side: "boss" as const,
    },
  ];

  // 5. Ordenar por prioridade > speed > random
  type ActionWithPriority = {
    action: InternalAction;
    effectiveSpeed: number;
    prioritySum: number;
  };

  const actionPriorities: ActionWithPriority[] = allActions.map((action) => {
    const entity = findEntity(clonedState, action.playerId);
    if (!entity) {
      throw new Error(`Entidade ${action.playerId} nao encontrada no estado`);
    }
    const effectiveSpeed = getEffectiveStat(
      entity.baseStats.speed,
      entity.stages.speed
    );
    const prioritySum = entity.buffs
      .filter((b) => b.stat === "priority")
      .reduce((sum, b) => sum + b.value, 0);

    return { action, effectiveSpeed, prioritySum };
  });

  const tiebreaker = (randomFn ?? Math.random)() > 0.5 ? -1 : 1;

  actionPriorities.sort((a, b) => {
    if (a.prioritySum !== b.prioritySum) {
      return b.prioritySum - a.prioritySum;
    }
    if (a.effectiveSpeed !== b.effectiveSpeed) {
      return b.effectiveSpeed - a.effectiveSpeed;
    }
    return tiebreaker;
  });

  const orderedActions = actionPriorities.map((ap) => ap.action);

  // 6. Resolver cada acao na ordem
  for (const action of orderedActions) {
    // a. Encontrar ator
    const actor = findEntity(clonedState, action.playerId);
    if (!actor) continue;

    // b. Skip se batalha acabou ou ator morto
    if (clonedState.status === "FINISHED") continue;
    if (actor.currentHp <= 0) continue;

    // c. Checar incapacitacao
    const incap = isIncapacitated(actor);
    if (incap.incapacitated) {
      actor.combo = { skillId: null, stacks: 0 };
      events.push({
        turn: clonedState.turnNumber,
        phase: "INCAPACITATED",
        actorId: actor.playerId,
        message: `${actor.playerId} esta incapacitado por ${incap.reason}`,
      });
      continue;
    }

    // d. Aplicar dano de status
    const statusEntries = applyStatusDamage(actor, clonedState.turnNumber);
    events.push(...statusEntries);

    if (actor.currentHp <= 0) {
      events.push({
        turn: clonedState.turnNumber,
        phase: "DEATH",
        targetId: actor.playerId,
        message: `${actor.playerId} foi derrotado por dano de status`,
      });
      checkCoopBattleEnd(clonedState, events);
      continue;
    }

    // e. Skip turn
    if (action.skillId === null) {
      events.push({
        turn: clonedState.turnNumber,
        phase: "SKIP",
        actorId: actor.playerId,
        message: `${actor.playerId} pulou o turno`,
      });
      continue;
    }

    // f. Validar skill
    const equipped = actor.equippedSkills.find(
      (es) => es.skillId === action.skillId
    );
    if (!equipped) {
      events.push({
        turn: clonedState.turnNumber,
        phase: "INVALID",
        actorId: actor.playerId,
        skillId: action.skillId,
        message: `${actor.playerId} tentou usar skill invalida`,
      });
      continue;
    }

    if (
      actor.cooldowns[action.skillId] &&
      actor.cooldowns[action.skillId] > 0
    ) {
      events.push({
        turn: clonedState.turnNumber,
        phase: "COOLDOWN",
        actorId: actor.playerId,
        skillId: action.skillId,
        skillName: equipped.skill.name,
        message: `${actor.playerId} tentou usar ${equipped.skill.name} mas esta em cooldown`,
      });
      continue;
    }

    const skill: Skill = equipped.skill;

    // g. Resolver combo
    let comboOverride: { basePower: number; hits: number } | undefined;
    const comboResult = getComboModifier(actor, skill);
    if (comboResult !== null) {
      actor.combo = comboResult.newCombo;
      comboOverride = {
        basePower: comboResult.basePower,
        hits: comboResult.hits,
      };
      events.push({
        turn: clonedState.turnNumber,
        phase: "COMBO",
        actorId: actor.playerId,
        skillId: skill.id,
        skillName: skill.name,
        comboStack: comboResult.newCombo.stacks,
        message: `${actor.playerId} usa ${skill.name} em combo (stack ${comboResult.newCombo.stacks})`,
      });
    } else {
      actor.combo = { skillId: action.skillId, stacks: 0 };
    }

    // h. Accuracy check (skip para suporte puro)
    const isSupportSelf =
      skill.damageType === "NONE" &&
      skill.basePower === 0 &&
      skill.target === "SELF";

    if (!isSupportSelf) {
      const stageMultiplier = STAGE_MULTIPLIERS[clampStage(actor.stages.accuracy)];
      const hitChance = Math.min(100, Math.max(10, skill.accuracy * stageMultiplier));
      const hit = (randomFn ?? Math.random)() * 100 < hitChance;

      if (!hit) {
        // Determinar um alvo representativo para o log de miss
        const missTargets = resolveCoopTargets({
          casterSide: action.side,
          caster: actor,
          skillTarget: skill.target,
          team: clonedState.team,
          boss: clonedState.boss,
          targetId: action.targetId,
          randomFn,
        });
        const missTargetId = missTargets.length > 0 ? missTargets[0].playerId : undefined;

        events.push({
          turn: clonedState.turnNumber,
          phase: "MISS",
          actorId: actor.playerId,
          targetId: missTargetId,
          skillId: skill.id,
          skillName: skill.name,
          missed: true,
          message: `${actor.playerId} usou ${skill.name} mas errou!`,
        });

        putOnCooldown(actor, skill.id);
        actor.combo = { skillId: null, stacks: 0 };
        continue;
      }
    }

    // i. Resolver alvos
    const targets = resolveCoopTargets({
      casterSide: action.side,
      caster: actor,
      skillTarget: skill.target,
      team: clonedState.team,
      boss: clonedState.boss,
      targetId: action.targetId,
      randomFn,
    });

    // j. Para cada alvo: calcular dano, aplicar, logar, processar counters
    for (const target of targets) {
      if (target.currentHp <= 0) continue;

      const dmgResult = calculateDamage({
        skill,
        attacker: actor,
        defender: target,
        comboOverride,
        randomFn,
      });

      if (dmgResult.totalDamage > 0) {
        target.currentHp = Math.max(0, target.currentHp - dmgResult.totalDamage);
        events.push({
          turn: clonedState.turnNumber,
          phase: "DAMAGE",
          actorId: actor.playerId,
          targetId: target.playerId,
          skillId: skill.id,
          skillName: skill.name,
          damage: dmgResult.totalDamage,
          message: `${actor.playerId} usa ${skill.name} e causa ${dmgResult.totalDamage} de dano em ${target.playerId} (${dmgResult.hits} hit${dmgResult.hits > 1 ? "s" : ""})`,
        });
      } else {
        events.push({
          turn: clonedState.turnNumber,
          phase: "ACTION",
          actorId: actor.playerId,
          targetId: target.playerId,
          skillId: skill.id,
          skillName: skill.name,
          message: `${actor.playerId} usa ${skill.name} em ${target.playerId}`,
        });
      }

      // Processar counters do defensor
      const countersCopy = [...target.counters];
      for (const counter of countersCopy) {
        if (counter.remainingTurns > 0 && dmgResult.totalDamage > 0) {
          const counterDamage = Math.max(
            1,
            Math.floor(dmgResult.totalDamage * counter.powerMultiplier)
          );
          actor.currentHp = Math.max(0, actor.currentHp - counterDamage);
          events.push({
            turn: clonedState.turnNumber,
            phase: "COUNTER",
            actorId: target.playerId,
            targetId: actor.playerId,
            damage: counterDamage,
            counterTriggered: true,
            message: `${target.playerId} contra-ataca ${actor.playerId} por ${counterDamage} de dano`,
          });

          if (counter.onTrigger) {
            applyCounterTriggerEffects(
              counter.onTrigger,
              target,
              actor,
              clonedState.turnNumber,
              events,
              randomFn
            );
          }

          // Apenas o primeiro counter ativo
          break;
        }
      }

      // Checar se o alvo morreu
      if (target.currentHp <= 0) {
        events.push({
          turn: clonedState.turnNumber,
          phase: "DEATH",
          targetId: target.playerId,
          message: `${target.playerId} foi derrotado`,
        });
      }

      // Checar se o atacante morreu por counter
      if (actor.currentHp <= 0) {
        events.push({
          turn: clonedState.turnNumber,
          phase: "DEATH",
          targetId: actor.playerId,
          message: `${actor.playerId} foi derrotado por contra-ataque`,
        });
      }
    }

    // k. Aplicar efeitos da skill via adapter (BattleState fake por alvo)
    for (const target of targets) {
      // Criar BattleState fake [caster, target] para applyEffects
      const fakeCaster = action.side === "boss" ? clonedState.boss : actor;
      const fakeTarget = fakeCaster.playerId === target.playerId ? fakeCaster : target;

      // Se caster e target sao a mesma entidade, applyEffects resolve via resolveTargets internamente
      // usando getPlayer(state, casterId) e getOpponent(state, casterId)
      // Posicao 0 = caster, posicao 1 = target
      const fakeState = makeFakeBattleState(
        fakeCaster,
        fakeTarget,
        clonedState.battleId,
        clonedState.turnNumber
      );

      const effectEntries = applyEffects({
        skill,
        casterId: actor.playerId,
        state: fakeState,
        totalDamage: 0, // Dano ja foi aplicado acima por alvo
        turnNumber: clonedState.turnNumber,
        randomFn,
      });
      events.push(...effectEntries);

      // Copiar mutacoes de volta: o fakeState referencia os mesmos objetos
      // que clonedState (nao houve clone), entao as mutacoes ja estao aplicadas
      // EXCETO se caster === target (SELF), nesse caso precisamos garantir
      // que ambas as posicoes do fakeState apontam para a mesma referencia
    }

    // l. Colocar skill em cooldown
    putOnCooldown(actor, skill.id);

    // m. Checar fim de batalha
    checkCoopBattleEnd(clonedState, events);
  }

  // 7. tickCoopEndOfTurn
  tickCoopEndOfTurn(clonedState, events);

  // 8. tickCooldowns para cada entidade
  tickCooldowns(clonedState.boss);
  for (const player of clonedState.team) {
    tickCooldowns(player);
  }

  // 9. Checar mortes por ON_EXPIRE
  if (clonedState.status !== "FINISHED") {
    checkCoopBattleEnd(clonedState, events);
  }

  // 10. Incrementar turno se IN_PROGRESS
  if (clonedState.status === "IN_PROGRESS") {
    clonedState.turnNumber += 1;
  }

  // 11. Checar MAX_TURNS
  if (clonedState.status === "IN_PROGRESS" && clonedState.turnNumber > MAX_TURNS) {
    clonedState.status = "FINISHED";
    clonedState.winnerId = null;
    events.push({
      turn: clonedState.turnNumber,
      phase: "DRAW",
      message: `Batalha cooperativa terminou em derrota apos ${MAX_TURNS} turnos`,
    });
  }

  // 12. Consolidar log e retornar
  clonedState.turnLog = [...clonedState.turnLog, ...events];
  return { state: clonedState, events };
}
