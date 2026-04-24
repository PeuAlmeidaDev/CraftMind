// lib/battle/pve-multi-turn.ts — Engine adapter para batalha PvE 1v3 / 1v5

import type { PlayerState, TurnLogEntry, BattleState, Skill } from "./types";
import type {
  MobState,
  PveMultiBattleState,
  PveMultiAction,
  PveMultiTurnResult,
  PveMultiMode,
} from "./pve-multi-types";
import { clampStage } from "./utils";
import { getEffectiveStat, calculateDamage } from "./damage";
import { getComboModifier, putOnCooldown, tickCooldowns } from "./skills";
import { isIncapacitated, applyStatusDamage } from "./status";
import { applyEffects } from "./effects";
import { chooseAction } from "./ai";
import { MAX_TURNS, STAGE_MULTIPLIERS } from "./constants";
import { calculateExtraActions } from "./speed";
import {
  applyCounterTriggerEffects,
  tickEntitiesEndOfTurn,
} from "./shared-helpers";

// ---------------------------------------------------------------------------
// Helpers: fake BattleState para adaptar funcoes existentes
// ---------------------------------------------------------------------------

const DUMMY_PLAYER_ID = "__pve_multi_dummy__";

function makeDummyPlayer(): PlayerState {
  return {
    playerId: DUMMY_PLAYER_ID,
    characterId: DUMMY_PLAYER_ID,
    baseStats: { physicalAtk: 1, physicalDef: 1, magicAtk: 1, magicDef: 1, hp: 1, speed: 1 },
    currentHp: 1,
    stages: { physicalAtk: 0, physicalDef: 0, magicAtk: 0, magicDef: 0, speed: 0, accuracy: 0 },
    statusEffects: [],
    buffs: [],
    vulnerabilities: [],
    counters: [],
    cooldowns: {},
    combo: { skillId: null, stacks: 0 },
    equippedSkills: [],
  };
}

function makeFakeBattleState(
  entity1: PlayerState,
  entity2: PlayerState,
  battleId: string,
  turnNumber: number
): BattleState {
  const player2 = entity1.playerId === entity2.playerId ? makeDummyPlayer() : entity2;
  return {
    battleId,
    turnNumber,
    players: [entity1, player2] as [PlayerState, PlayerState],
    turnLog: [],
    status: "IN_PROGRESS",
    winnerId: null,
  };
}

// ---------------------------------------------------------------------------
// initMultiPveBattle
// ---------------------------------------------------------------------------

export function initMultiPveBattle(config: {
  battleId: string;
  player: PlayerState;
  mobs: MobState[];
  mode?: PveMultiMode;
}): PveMultiBattleState {
  if (config.mobs.length === 0) {
    throw new Error("initMultiPveBattle requires at least 1 mob");
  }

  return {
    battleId: config.battleId,
    player: config.player,
    mobs: config.mobs,
    mode: config.mode ?? "1v3",
    turnNumber: 1,
    status: "IN_PROGRESS",
    result: "PENDING",
    turnLog: [],
  };
}

// ---------------------------------------------------------------------------
// resolveMultiPveTurn
// ---------------------------------------------------------------------------

export function resolveMultiPveTurn(
  state: PveMultiBattleState,
  playerAction: PveMultiAction,
  randomFn?: () => number
): PveMultiTurnResult {
  // 0. Guard: batalha ja finalizada
  if (state.status === "FINISHED") {
    return { state, events: [] };
  }

  // 1. Deep clone
  const s = structuredClone(state);
  const events: TurnLogEntry[] = [];

  // 1b. Calcular acoes extras por speed
  const playerSpeed = getEffectiveStat(s.player.baseStats.speed, s.player.stages.speed);
  const aliveMobSpeeds = s.mobs.filter((m) => !m.defeated).map((m) => getEffectiveStat(m.baseStats.speed, m.stages.speed));
  const maxMobSpeed = aliveMobSpeeds.length > 0 ? Math.max(...aliveMobSpeeds) : 0;
  const { extraA: playerExtras, extraB: mobExtras } = calculateExtraActions(playerSpeed, maxMobSpeed);

  if (playerExtras > 0) {
    events.push({
      turn: s.turnNumber,
      phase: "SPEED_ADVANTAGE",
      actorId: s.player.playerId,
      message: `${s.player.playerId} ganha ${playerExtras} acao(oes) extra(s) por vantagem de speed (${Math.round(playerSpeed)} vs ${Math.round(maxMobSpeed)})`,
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Turno do player
  // ---------------------------------------------------------------------------

  const player = s.player;

  // Checar incapacitacao
  const incap = isIncapacitated(player);
  if (incap.incapacitated) {
    player.combo = { skillId: null, stacks: 0 };
    events.push({
      turn: s.turnNumber,
      phase: "INCAPACITATED",
      actorId: player.playerId,
      message: `${player.playerId} esta incapacitado por ${incap.reason}`,
    });

    // Aplicar status damage mesmo incapacitado
    const statusEntries = applyStatusDamage(player, s.turnNumber);
    events.push(...statusEntries);

    if (player.currentHp <= 0) {
      s.status = "FINISHED";
      s.result = "DEFEAT";
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: player.playerId,
        message: `${player.playerId} foi derrotado por dano de status`,
      });
      s.turnLog = [...s.turnLog, ...events];
      return { state: s, events };
    }
  } else {
    // Aplicar status damage
    const statusEntries = applyStatusDamage(player, s.turnNumber);
    events.push(...statusEntries);

    if (player.currentHp <= 0) {
      s.status = "FINISHED";
      s.result = "DEFEAT";
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: player.playerId,
        message: `${player.playerId} foi derrotado por dano de status`,
      });
      s.turnLog = [...s.turnLog, ...events];
      return { state: s, events };
    }

    // Resolver skill do player (se nao incapacitado)
    if (playerAction.skillId !== null) {
      resolvePlayerSkill(s, player, playerAction, events, randomFn);

      // Checar se player morreu por counter
      if (player.currentHp <= 0) {
        s.status = "FINISHED";
        s.result = "DEFEAT";
        s.turnLog = [...s.turnLog, ...events];
        return { state: s, events };
      }

      // Checar vitoria
      if (s.mobs.every((m) => m.defeated)) {
        s.status = "FINISHED";
        s.result = "VICTORY";
        s.turnLog = [...s.turnLog, ...events];
        return { state: s, events };
      }
    } else {
      events.push({
        turn: s.turnNumber,
        phase: "SKIP",
        actorId: player.playerId,
        message: `${player.playerId} pulou o turno`,
      });
    }
  }

  // 2b. Acoes extras do player por speed
  if (s.result === "PENDING" && playerExtras > 0 && !isIncapacitated(player).incapacitated && player.currentHp > 0) {
    for (let extraIdx = 0; extraIdx < playerExtras; extraIdx++) {
      if (s.result !== "PENDING" || player.currentHp <= 0) break;

      if (playerAction.skillId !== null) {
        resolvePlayerSkill(s, player, playerAction, events, randomFn);

        if (player.currentHp <= 0) {
          s.status = "FINISHED";
          s.result = "DEFEAT";
          s.turnLog = [...s.turnLog, ...events];
          return { state: s, events };
        }

        if (s.mobs.every((m) => m.defeated)) {
          s.status = "FINISHED";
          s.result = "VICTORY";
          s.turnLog = [...s.turnLog, ...events];
          return { state: s, events };
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Turno dos mobs (ordenados por speed DESC)
  // ---------------------------------------------------------------------------

  const aliveMobs = s.mobs
    .map((mob, idx) => ({ mob, idx }))
    .filter(({ mob }) => !mob.defeated)
    .sort((a, b) => {
      const speedDiff = b.mob.baseStats.speed - a.mob.baseStats.speed;
      if (speedDiff !== 0) return speedDiff;
      return a.idx - b.idx; // desempate: index menor primeiro
    });

  for (const { mob } of aliveMobs) {
    if (s.status === "FINISHED") break;

    // Checar incapacitacao do mob
    const mobIncap = isIncapacitated(mob);
    if (mobIncap.incapacitated) {
      mob.combo = { skillId: null, stacks: 0 };
      events.push({
        turn: s.turnNumber,
        phase: "INCAPACITATED",
        actorId: mob.playerId,
        message: `${mob.playerId} esta incapacitado por ${mobIncap.reason}`,
      });

      // Status damage do mob incapacitado
      const mobStatusEntries = applyStatusDamage(mob, s.turnNumber);
      events.push(...mobStatusEntries);

      if (mob.currentHp <= 0) {
        mob.defeated = true;
        events.push({
          turn: s.turnNumber,
          phase: "DEATH",
          targetId: mob.playerId,
          message: `${mob.playerId} foi derrotado por dano de status`,
        });
      }
      continue;
    }

    // Status damage do mob
    const mobStatusEntries = applyStatusDamage(mob, s.turnNumber);
    events.push(...mobStatusEntries);

    if (mob.currentHp <= 0) {
      mob.defeated = true;
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: mob.playerId,
        message: `${mob.playerId} foi derrotado por dano de status`,
      });
      continue;
    }

    // Gerar action via IA
    const fakeBattleState = makeFakeBattleState(
      mob,
      player,
      s.battleId,
      s.turnNumber
    );

    const aiAction = chooseAction({
      state: fakeBattleState,
      mobPlayerId: mob.playerId,
      profile: mob.profile,
      randomFn,
    });

    if (aiAction.skillId === null) {
      events.push({
        turn: s.turnNumber,
        phase: "SKIP",
        actorId: mob.playerId,
        message: `${mob.playerId} pulou o turno`,
      });
      continue;
    }

    // Resolver skill do mob contra o player
    resolveMobSkill(s, mob, player, aiAction.skillId, events, randomFn);

    // Checar se player morreu
    if (player.currentHp <= 0) {
      s.status = "FINISHED";
      s.result = "DEFEAT";
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: player.playerId,
        message: `${player.playerId} foi derrotado`,
      });
      break;
    }

    // Checar se mob morreu por counter
    if (mob.currentHp <= 0) {
      mob.defeated = true;
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: mob.playerId,
        message: `${mob.playerId} foi derrotado por contra-ataque`,
      });
    }
  }

  // 3b. Acoes extras dos mobs por speed (mob mais rapido ganha extras)
  if (s.result === "PENDING" && mobExtras > 0) {
    const fastestMob = s.mobs
      .filter((m) => !m.defeated)
      .sort((a, b) => getEffectiveStat(b.baseStats.speed, b.stages.speed) - getEffectiveStat(a.baseStats.speed, a.stages.speed))[0];

    if (fastestMob && !isIncapacitated(fastestMob).incapacitated) {
      events.push({
        turn: s.turnNumber,
        phase: "SPEED_ADVANTAGE",
        actorId: fastestMob.playerId,
        message: `${fastestMob.playerId} ganha ${mobExtras} acao(oes) extra(s) por vantagem de speed`,
      });

      for (let extraIdx = 0; extraIdx < mobExtras; extraIdx++) {
        if (s.result !== "PENDING" || fastestMob.defeated || player.currentHp <= 0) break;

        const extraFake = makeFakeBattleState(fastestMob, player, s.battleId, s.turnNumber);
        const extraAi = chooseAction({ state: extraFake, mobPlayerId: fastestMob.playerId, profile: fastestMob.profile, randomFn });

        if (extraAi.skillId !== null) {
          resolveMobSkill(s, fastestMob, player, extraAi.skillId, events, randomFn);

          if (player.currentHp <= 0) {
            s.status = "FINISHED";
            s.result = "DEFEAT";
            events.push({ turn: s.turnNumber, phase: "DEATH", targetId: player.playerId, message: `${player.playerId} foi derrotado` });
            break;
          }

          if (fastestMob.currentHp <= 0) {
            fastestMob.defeated = true;
          }
        }
      }
    }
  }

  // Checar vitoria apos turno dos mobs (mobs podem ter morrido por status/counter)
  if (s.status !== "FINISHED" && s.mobs.every((m) => m.defeated)) {
    s.status = "FINISHED";
    s.result = "VICTORY";
    s.turnLog = [...s.turnLog, ...events];
    return { state: s, events };
  }

  // ---------------------------------------------------------------------------
  // 4. End of turn
  // ---------------------------------------------------------------------------

  if (s.status !== "FINISHED") {
    // tickEndOfTurn para player e mobs vivos
    const aliveEntities: PlayerState[] = [
      player,
      ...s.mobs.filter((m) => !m.defeated),
    ];
    tickEntitiesEndOfTurn(aliveEntities, s.turnNumber, events);

    // tickCooldowns
    tickCooldowns(player);
    for (const mob of s.mobs) {
      if (!mob.defeated) {
        tickCooldowns(mob);
      }
    }

    // Checar mortes por ON_EXPIRE
    if (player.currentHp <= 0) {
      s.status = "FINISHED";
      s.result = "DEFEAT";
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: player.playerId,
        message: `${player.playerId} foi derrotado por efeito expirado`,
      });
    } else {
      for (const mob of s.mobs) {
        if (!mob.defeated && mob.currentHp <= 0) {
          mob.defeated = true;
          events.push({
            turn: s.turnNumber,
            phase: "DEATH",
            targetId: mob.playerId,
            message: `${mob.playerId} foi derrotado por efeito expirado`,
          });
        }
      }

      if (s.mobs.every((m) => m.defeated)) {
        s.status = "FINISHED";
        s.result = "VICTORY";
      }
    }

    // Incrementar turno
    if (s.status !== "FINISHED") {
      s.turnNumber += 1;

      if (s.turnNumber > MAX_TURNS) {
        s.status = "FINISHED";
        s.result = "DEFEAT";
        events.push({
          turn: s.turnNumber,
          phase: "DRAW",
          message: `Batalha PvE Multi terminou em derrota apos ${MAX_TURNS} turnos`,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Consolidar e retornar
  // ---------------------------------------------------------------------------

  s.turnLog = [...s.turnLog, ...events];
  return { state: s, events };
}

// ---------------------------------------------------------------------------
// resolvePlayerSkill — Resolve a skill do player contra mobs
// ---------------------------------------------------------------------------

function resolvePlayerSkill(
  s: PveMultiBattleState,
  player: PlayerState,
  action: PveMultiAction,
  events: TurnLogEntry[],
  randomFn?: () => number
): void {
  const equipped = player.equippedSkills.find(
    (es) => es.skillId === action.skillId
  );

  if (!equipped) {
    events.push({
      turn: s.turnNumber,
      phase: "INVALID",
      actorId: player.playerId,
      skillId: action.skillId ?? undefined,
      message: `${player.playerId} tentou usar skill invalida`,
    });
    return;
  }

  if (player.cooldowns[equipped.skillId] && player.cooldowns[equipped.skillId] > 0) {
    events.push({
      turn: s.turnNumber,
      phase: "COOLDOWN",
      actorId: player.playerId,
      skillId: equipped.skillId,
      skillName: equipped.skill.name,
      message: `${player.playerId} tentou usar ${equipped.skill.name} mas esta em cooldown`,
    });
    return;
  }

  const skill: Skill = equipped.skill;

  // Validar target para SINGLE_ENEMY
  if (skill.target === "SINGLE_ENEMY") {
    if (action.targetIndex === undefined) {
      events.push({
        turn: s.turnNumber,
        phase: "INVALID",
        actorId: player.playerId,
        skillId: skill.id,
        skillName: skill.name,
        message: `${player.playerId} tentou usar ${skill.name} sem selecionar alvo`,
      });
      return;
    }
    if (action.targetIndex < 0 || action.targetIndex > s.mobs.length - 1) {
      events.push({
        turn: s.turnNumber,
        phase: "INVALID",
        actorId: player.playerId,
        message: `${player.playerId} selecionou alvo invalido (index ${action.targetIndex})`,
      });
      return;
    }
    if (s.mobs[action.targetIndex].defeated) {
      events.push({
        turn: s.turnNumber,
        phase: "INVALID",
        actorId: player.playerId,
        message: `${player.playerId} selecionou alvo ja derrotado`,
      });
      return;
    }
  }

  // Combo
  let comboOverride: { basePower: number; hits: number } | undefined;
  const comboResult = getComboModifier(player, skill);
  if (comboResult !== null) {
    player.combo = comboResult.newCombo;
    comboOverride = { basePower: comboResult.basePower, hits: comboResult.hits };
    events.push({
      turn: s.turnNumber,
      phase: "COMBO",
      actorId: player.playerId,
      skillId: skill.id,
      skillName: skill.name,
      comboStack: comboResult.newCombo.stacks,
      message: `${player.playerId} usa ${skill.name} em combo (stack ${comboResult.newCombo.stacks})`,
    });
  } else {
    player.combo = { skillId: action.skillId!, stacks: 0 };
  }

  // Accuracy check (skip para suporte puro)
  const isSupportSelf =
    skill.damageType === "NONE" &&
    skill.basePower === 0 &&
    skill.target === "SELF";

  if (!isSupportSelf) {
    const stageMultiplier = STAGE_MULTIPLIERS[clampStage(player.stages.accuracy)];
    const hitChance = Math.min(100, Math.max(10, skill.accuracy * stageMultiplier));
    const hit = (randomFn ?? Math.random)() * 100 < hitChance;

    if (!hit) {
      events.push({
        turn: s.turnNumber,
        phase: "MISS",
        actorId: player.playerId,
        skillId: skill.id,
        skillName: skill.name,
        missed: true,
        message: `${player.playerId} usou ${skill.name} mas errou!`,
      });
      putOnCooldown(player, skill.id);
      player.combo = { skillId: null, stacks: 0 };
      return;
    }
  }

  // Determinar alvos
  const targets = resolveMultiTargets(s, player, skill, action.targetIndex);

  // Resolver dano e efeitos por alvo
  for (const target of targets) {
    if ((target as MobState).defeated) continue;
    if (target.currentHp <= 0) continue;

    const dmgResult = calculateDamage({
      skill,
      attacker: player,
      defender: target,
      comboOverride,
      randomFn,
    });

    if (dmgResult.totalDamage > 0) {
      target.currentHp = Math.max(0, target.currentHp - dmgResult.totalDamage);
      events.push({
        turn: s.turnNumber,
        phase: "DAMAGE",
        actorId: player.playerId,
        targetId: target.playerId,
        skillId: skill.id,
        skillName: skill.name,
        damage: dmgResult.totalDamage,
        message: `${player.playerId} usa ${skill.name} e causa ${dmgResult.totalDamage} de dano em ${target.playerId} (${dmgResult.hits} hit${dmgResult.hits > 1 ? "s" : ""})`,
      });
    } else {
      events.push({
        turn: s.turnNumber,
        phase: "ACTION",
        actorId: player.playerId,
        targetId: target.playerId,
        skillId: skill.id,
        skillName: skill.name,
        message: `${player.playerId} usa ${skill.name} em ${target.playerId}`,
      });
    }

    // Processar counters
    const countersCopy = [...target.counters];
    for (const counter of countersCopy) {
      if (counter.remainingTurns > 0 && dmgResult.totalDamage > 0) {
        const counterDamage = Math.max(
          1,
          Math.floor(dmgResult.totalDamage * counter.powerMultiplier)
        );
        player.currentHp = Math.max(0, player.currentHp - counterDamage);
        events.push({
          turn: s.turnNumber,
          phase: "COUNTER",
          actorId: target.playerId,
          targetId: player.playerId,
          damage: counterDamage,
          counterTriggered: true,
          message: `${target.playerId} contra-ataca ${player.playerId} por ${counterDamage} de dano`,
        });

        if (counter.onTrigger) {
          applyCounterTriggerEffects(
            counter.onTrigger,
            target,
            player,
            s.turnNumber,
            events,
            randomFn
          );
        }
        break; // Apenas o primeiro counter ativo
      }
    }

    // Checar se alvo morreu
    if (target.currentHp <= 0 && "defeated" in target) {
      (target as MobState).defeated = true;
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: target.playerId,
        message: `${target.playerId} foi derrotado`,
      });
    }

    // Se player morreu por counter
    if (player.currentHp <= 0) {
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: player.playerId,
        message: `${player.playerId} foi derrotado por contra-ataque`,
      });
      putOnCooldown(player, skill.id);
      return;
    }
  }

  // Aplicar efeitos da skill por alvo
  for (const target of targets) {
    if ("defeated" in target && (target as MobState).defeated && target.currentHp <= 0) continue;

    const fakeState = makeFakeBattleState(
      player,
      target,
      s.battleId,
      s.turnNumber
    );

    const effectEntries = applyEffects({
      skill,
      casterId: player.playerId,
      state: fakeState,
      totalDamage: 0,
      turnNumber: s.turnNumber,
      randomFn,
    });
    events.push(...effectEntries);

    // Copiar mutacoes de volta do fakeState para o estado real
    // player esta na posicao 0 do fakeState - mutacoes ja aplicadas por referencia
    // target esta na posicao 1 (ou dummy) - se for o target real, mutacoes ja aplicadas
  }

  // Cooldown
  putOnCooldown(player, skill.id);
}

// ---------------------------------------------------------------------------
// resolveMobSkill — Resolve a skill de um mob contra o player
// ---------------------------------------------------------------------------

function resolveMobSkill(
  s: PveMultiBattleState,
  mob: MobState,
  player: PlayerState,
  skillId: string,
  events: TurnLogEntry[],
  randomFn?: () => number
): void {
  const equipped = mob.equippedSkills.find((es) => es.skillId === skillId);

  if (!equipped) {
    events.push({
      turn: s.turnNumber,
      phase: "INVALID",
      actorId: mob.playerId,
      message: `${mob.playerId} tentou usar skill invalida`,
    });
    return;
  }

  if (mob.cooldowns[skillId] && mob.cooldowns[skillId] > 0) {
    events.push({
      turn: s.turnNumber,
      phase: "COOLDOWN",
      actorId: mob.playerId,
      skillId,
      skillName: equipped.skill.name,
      message: `${mob.playerId} tentou usar ${equipped.skill.name} mas esta em cooldown`,
    });
    return;
  }

  const skill: Skill = equipped.skill;

  // Combo
  let comboOverride: { basePower: number; hits: number } | undefined;
  const comboResult = getComboModifier(mob, skill);
  if (comboResult !== null) {
    mob.combo = comboResult.newCombo;
    comboOverride = { basePower: comboResult.basePower, hits: comboResult.hits };
    events.push({
      turn: s.turnNumber,
      phase: "COMBO",
      actorId: mob.playerId,
      skillId: skill.id,
      skillName: skill.name,
      comboStack: comboResult.newCombo.stacks,
      message: `${mob.playerId} usa ${skill.name} em combo (stack ${comboResult.newCombo.stacks})`,
    });
  } else {
    mob.combo = { skillId, stacks: 0 };
  }

  // Accuracy check
  const isSupportSelf =
    skill.damageType === "NONE" &&
    skill.basePower === 0 &&
    skill.target === "SELF";

  if (!isSupportSelf) {
    const stageMultiplier = STAGE_MULTIPLIERS[clampStage(mob.stages.accuracy)];
    const hitChance = Math.min(100, Math.max(10, skill.accuracy * stageMultiplier));
    const hit = (randomFn ?? Math.random)() * 100 < hitChance;

    if (!hit) {
      events.push({
        turn: s.turnNumber,
        phase: "MISS",
        actorId: mob.playerId,
        targetId: player.playerId,
        skillId: skill.id,
        skillName: skill.name,
        missed: true,
        message: `${mob.playerId} usou ${skill.name} mas errou!`,
      });
      putOnCooldown(mob, skill.id);
      mob.combo = { skillId: null, stacks: 0 };
      return;
    }
  }

  // Determinar alvo do mob
  // Em PvE 1v3, mob skills SINGLE_ENEMY/ALL_ENEMIES sempre atingem o player
  // SELF atinge o proprio mob
  let target: PlayerState;
  if (skill.target === "SELF" || skill.target === "SINGLE_ALLY" || skill.target === "ALL_ALLIES") {
    target = mob;
  } else {
    target = player;
  }

  const dmgResult = calculateDamage({
    skill,
    attacker: mob,
    defender: target,
    comboOverride,
    randomFn,
  });

  if (dmgResult.totalDamage > 0) {
    target.currentHp = Math.max(0, target.currentHp - dmgResult.totalDamage);
    events.push({
      turn: s.turnNumber,
      phase: "DAMAGE",
      actorId: mob.playerId,
      targetId: target.playerId,
      skillId: skill.id,
      skillName: skill.name,
      damage: dmgResult.totalDamage,
      message: `${mob.playerId} usa ${skill.name} e causa ${dmgResult.totalDamage} de dano em ${target.playerId} (${dmgResult.hits} hit${dmgResult.hits > 1 ? "s" : ""})`,
    });
  } else {
    events.push({
      turn: s.turnNumber,
      phase: "ACTION",
      actorId: mob.playerId,
      targetId: target.playerId,
      skillId: skill.id,
      skillName: skill.name,
      message: `${mob.playerId} usa ${skill.name} em ${target.playerId}`,
    });
  }

  // Processar counters do alvo (player)
  if (target.playerId === player.playerId) {
    const countersCopy = [...player.counters];
    for (const counter of countersCopy) {
      if (counter.remainingTurns > 0 && dmgResult.totalDamage > 0) {
        const counterDamage = Math.max(
          1,
          Math.floor(dmgResult.totalDamage * counter.powerMultiplier)
        );
        mob.currentHp = Math.max(0, mob.currentHp - counterDamage);
        events.push({
          turn: s.turnNumber,
          phase: "COUNTER",
          actorId: player.playerId,
          targetId: mob.playerId,
          damage: counterDamage,
          counterTriggered: true,
          message: `${player.playerId} contra-ataca ${mob.playerId} por ${counterDamage} de dano`,
        });

        if (counter.onTrigger) {
          applyCounterTriggerEffects(
            counter.onTrigger,
            player,
            mob,
            s.turnNumber,
            events,
            randomFn
          );
        }
        break;
      }
    }
  }

  // Aplicar efeitos da skill
  const fakeState = makeFakeBattleState(
    mob,
    target,
    s.battleId,
    s.turnNumber
  );

  const effectEntries = applyEffects({
    skill,
    casterId: mob.playerId,
    state: fakeState,
    totalDamage: 0,
    turnNumber: s.turnNumber,
    randomFn,
  });
  events.push(...effectEntries);

  // Cooldown
  putOnCooldown(mob, skill.id);
}

// ---------------------------------------------------------------------------
// resolveMultiTargets — Determina alvos do player com base no skill.target
// ---------------------------------------------------------------------------

function resolveMultiTargets(
  s: PveMultiBattleState,
  player: PlayerState,
  skill: Skill,
  targetIndex?: number
): PlayerState[] {
  switch (skill.target) {
    case "SINGLE_ENEMY":
      if (targetIndex !== undefined && !s.mobs[targetIndex].defeated) {
        return [s.mobs[targetIndex]];
      }
      return [];

    case "ALL_ENEMIES":
      return s.mobs.filter((m) => !m.defeated);

    case "SELF":
    case "SINGLE_ALLY":
    case "ALL_ALLIES":
      // Em PvE 1v3, player e o unico aliado
      return [player];

    case "ALL":
      return [player, ...s.mobs.filter((m) => !m.defeated)];

    default:
      return [];
  }
}
