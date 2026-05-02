// lib/battle/coop-pve-turn.ts — Engine para batalha cooperativa PvE (2v3 / 2v5 / 3v5)

import type {
  BattleState,
  TurnLogEntry,
  PlayerState,
  Skill,
} from "./types";
import type {
  CoopPveBattleState,
  CoopPveAction,
  CoopPveTurnResult,
  CoopPveBattleConfig,
} from "./coop-pve-types";
import type { MobState } from "./pve-multi-types";
import { clampStage } from "./utils";
import { getEffectiveStat, calculateDamage } from "./damage";
import { getComboModifier, putOnCooldown, tickCooldowns } from "./skills";
import { isIncapacitated, applyStatusDamage } from "./status";
import { applyEffects } from "./effects";
import { chooseAction } from "./ai";
import { chooseBossTarget } from "./coop-target";
import { MAX_TURNS, STAGE_MULTIPLIERS } from "./constants";
import {
  createPlayerState,
  applyCounterTriggerEffects,
  tickEntitiesEndOfTurn,
} from "./shared-helpers";

// ---------------------------------------------------------------------------
// Helper: criar BattleState fake para adaptar funcoes existentes
// ---------------------------------------------------------------------------

const DUMMY_PLAYER_ID = "__coop_pve_dummy__";

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
// initCoopPveBattle
// ---------------------------------------------------------------------------

export function initCoopPveBattle(config: CoopPveBattleConfig): CoopPveBattleState {
  const expectedPlayers = config.mode === "3v5" ? 3 : 2;
  if (config.team.length !== expectedPlayers) {
    throw new Error(
      `Modo ${config.mode} requer ${expectedPlayers} jogadores (recebeu ${config.team.length})`
    );
  }

  const expectedMobs = config.mode === "2v3" ? 3 : 5; // 2v5 e 3v5 ambos usam 5 mobs
  if (config.mobs.length !== expectedMobs) {
    throw new Error(
      `Modo ${config.mode} requer exatamente ${expectedMobs} mobs (recebeu ${config.mobs.length})`
    );
  }

  const teamStates = config.team.map((p) => createPlayerState(p));

  const mobStates: MobState[] = config.mobs.map((mob) => {
    const base = createPlayerState({
      userId: crypto.randomUUID(),
      characterId: mob.mobId,
      stats: mob.stats,
      skills: mob.skills,
    });
    return {
      ...base,
      mobId: mob.mobId,
      profile: mob.aiProfile,
      defeated: false,
    };
  });

  return {
    battleId: config.battleId,
    turnNumber: 1,
    team: teamStates,
    mobs: mobStates,
    mode: config.mode,
    status: "IN_PROGRESS",
    result: "PENDING",
    turnLog: [],
  };
}

// ---------------------------------------------------------------------------
// resolveCoopPveTurn
// ---------------------------------------------------------------------------

export function resolveCoopPveTurn(
  state: CoopPveBattleState,
  teamActions: CoopPveAction[],
  randomFn?: () => number
): CoopPveTurnResult {
  // 0. Guard: batalha ja finalizada
  if (state.status === "FINISHED") {
    return { state, events: [] };
  }

  // 1. Deep clone
  const s = structuredClone(state);
  const events: TurnLogEntry[] = [];

  // 2. Validar acoes do time
  const aliveTeamPlayers = s.team.filter((p) => p.currentHp > 0);
  const aliveTeamIds = new Set(aliveTeamPlayers.map((p) => p.playerId));

  // Filtrar acoes validas (apenas de players vivos)
  const validActions = teamActions.filter((a) => aliveTeamIds.has(a.playerId));

  if (validActions.length !== aliveTeamPlayers.length) {
    throw new Error(
      `Esperava ${aliveTeamPlayers.length} acoes (players vivos), recebeu ${validActions.length} acoes validas`
    );
  }

  const actionPlayerIds = new Set(validActions.map((a) => a.playerId));
  if (actionPlayerIds.size !== validActions.length) {
    throw new Error("Acoes duplicadas: cada jogador deve enviar exatamente 1 acao");
  }

  for (const action of validActions) {
    if (!aliveTeamIds.has(action.playerId)) {
      throw new Error(
        `PlayerId ${action.playerId} nao pertence ao time ou esta morto`
      );
    }
  }

  // 3. Gerar acoes dos mobs via IA
  type MobAction = { mob: MobState; skillId: string | null; targetPlayerId: string | null };
  const mobActions: MobAction[] = [];

  const aliveMobsForAi = s.mobs.filter((m) => !m.defeated);
  const aliveTeamForTarget = s.team.filter((p) => p.currentHp > 0);

  for (const mob of aliveMobsForAi) {
    if (aliveTeamForTarget.length === 0) {
      mobActions.push({ mob, skillId: null, targetPlayerId: null });
      continue;
    }

    const targetPlayerId = chooseBossTarget(aliveTeamForTarget, randomFn);
    const targetPlayer = aliveTeamForTarget.find((p) => p.playerId === targetPlayerId);

    if (!targetPlayer) {
      mobActions.push({ mob, skillId: null, targetPlayerId: null });
      continue;
    }

    const fakeBattleState = makeFakeBattleState(
      mob,
      targetPlayer,
      s.battleId,
      s.turnNumber
    );

    const aiAction = chooseAction({
      state: fakeBattleState,
      mobPlayerId: mob.playerId,
      profile: mob.profile,
      randomFn,
    });

    mobActions.push({ mob, skillId: aiAction.skillId, targetPlayerId });
  }

  // 4. Players resolvem PRIMEIRO (ordenados por speed DESC)
  const sortedPlayerActions = [...validActions].sort((a, b) => {
    const playerA = s.team.find((p) => p.playerId === a.playerId);
    const playerB = s.team.find((p) => p.playerId === b.playerId);
    if (!playerA || !playerB) return 0;
    const speedA = getEffectiveStat(playerA.baseStats.speed, playerA.stages.speed);
    const speedB = getEffectiveStat(playerB.baseStats.speed, playerB.stages.speed);
    if (speedA !== speedB) return speedB - speedA;
    return (randomFn ?? Math.random)() > 0.5 ? -1 : 1;
  });

  for (const action of sortedPlayerActions) {
    // a. Skip se batalha acabou
    if (s.status === "FINISHED") break;

    const player = s.team.find((p) => p.playerId === action.playerId);
    if (!player || player.currentHp <= 0) continue;

    // b. Checar incapacitacao
    const incap = isIncapacitated(player);

    // c. Aplicar dano de status
    const statusEntries = applyStatusDamage(player, s.turnNumber);
    events.push(...statusEntries);

    // d. Se morreu por status -> checar se todos mortos -> DEFEAT
    if (player.currentHp <= 0) {
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: player.playerId,
        message: `${player.playerId} foi derrotado por dano de status`,
      });
      if (s.team.every((p) => p.currentHp <= 0)) {
        s.status = "FINISHED";
        s.result = "DEFEAT";
        events.push({
          turn: s.turnNumber,
          phase: "DEATH",
          message: "Todo o time foi derrotado. Os mobs vencem.",
        });
      }
      continue;
    }

    // e. Se incapacitado ou skillId === null -> skip com log
    if (incap.incapacitated) {
      player.combo = { skillId: null, stacks: 0 };
      events.push({
        turn: s.turnNumber,
        phase: "INCAPACITATED",
        actorId: player.playerId,
        message: `${player.playerId} esta incapacitado por ${incap.reason}`,
      });
      continue;
    }

    if (action.skillId === null) {
      events.push({
        turn: s.turnNumber,
        phase: "SKIP",
        actorId: player.playerId,
        message: `${player.playerId} pulou o turno`,
      });
      continue;
    }

    // f. Validar skill
    const equipped = player.equippedSkills.find(
      (es) => es.skillId === action.skillId
    );
    if (!equipped) {
      events.push({
        turn: s.turnNumber,
        phase: "INVALID",
        actorId: player.playerId,
        skillId: action.skillId,
        message: `${player.playerId} tentou usar skill invalida`,
      });
      continue;
    }

    if (player.cooldowns[action.skillId] && player.cooldowns[action.skillId] > 0) {
      events.push({
        turn: s.turnNumber,
        phase: "COOLDOWN",
        actorId: player.playerId,
        skillId: action.skillId,
        skillName: equipped.skill.name,
        message: `${player.playerId} tentou usar ${equipped.skill.name} mas esta em cooldown`,
      });
      continue;
    }

    const skill: Skill = equipped.skill;

    // g. Resolver combo
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
      player.combo = { skillId: action.skillId, stacks: 0 };
    }

    // h. Accuracy check (skip para suporte puro)
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
        continue;
      }
    }

    // i. Resolver alvos
    const targets = resolveCoopPvePlayerTargets(s, player, skill, action);

    // j. Para cada alvo: dano, counters, checar mortes
    for (const target of targets) {
      if (target.currentHp <= 0) continue;
      if ("defeated" in target && (target as MobState).defeated) continue;

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
          damageType: skill.damageType,
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

      // Processar counters do defensor
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
            damageType: skill.damageType,
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

      // Checar se mob morreu
      if (target.currentHp <= 0 && "defeated" in target) {
        (target as MobState).defeated = true;
        events.push({
          turn: s.turnNumber,
          phase: "DEATH",
          targetId: target.playerId,
          message: `${target.playerId} foi derrotado`,
        });
      }

      // Checar se player morreu por counter
      if (player.currentHp <= 0) {
        events.push({
          turn: s.turnNumber,
          phase: "DEATH",
          targetId: player.playerId,
          message: `${player.playerId} foi derrotado por contra-ataque`,
        });
        if (s.team.every((p) => p.currentHp <= 0)) {
          s.status = "FINISHED";
          s.result = "DEFEAT";
          events.push({
            turn: s.turnNumber,
            phase: "DEATH",
            message: "Todo o time foi derrotado. Os mobs vencem.",
          });
        }
        break;
      }
    }

    // k. Aplicar efeitos via adapter
    if (s.status !== "FINISHED") {
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
      }
    }

    // l. putOnCooldown
    putOnCooldown(player, skill.id);

    // m. Se todos mobs defeated -> VICTORY
    if (s.mobs.every((m) => m.defeated)) {
      s.status = "FINISHED";
      s.result = "VICTORY";
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        message: "Todos os mobs foram derrotados! O time vence!",
      });
      break;
    }
  }

  // 5. Mobs resolvem DEPOIS (speed DESC, desempate index menor)
  if (s.status !== "FINISHED") {
    const sortedMobActions = mobActions
      .map((ma, idx) => ({ ...ma, originalIndex: idx }))
      .filter(({ mob }) => !mob.defeated)
      .sort((a, b) => {
        const speedA = getEffectiveStat(a.mob.baseStats.speed, a.mob.stages.speed);
        const speedB = getEffectiveStat(b.mob.baseStats.speed, b.mob.stages.speed);
        if (speedA !== speedB) return speedB - speedA;
        return a.originalIndex - b.originalIndex;
      });

    for (const { mob, skillId, targetPlayerId } of sortedMobActions) {
      // a. Skip se batalha acabou (cast necessario pois TS nao rastreia mutacao dentro do loop)
      if ((s.status as string) === "FINISHED") break;
      if (mob.defeated) continue;

      // b. Checar incapacitacao do mob
      const mobIncap = isIncapacitated(mob);

      // c. Aplicar dano de status do mob
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

      if (mobIncap.incapacitated) {
        mob.combo = { skillId: null, stacks: 0 };
        events.push({
          turn: s.turnNumber,
          phase: "INCAPACITATED",
          actorId: mob.playerId,
          message: `${mob.playerId} esta incapacitado por ${mobIncap.reason}`,
        });
        continue;
      }

      if (skillId === null) {
        events.push({
          turn: s.turnNumber,
          phase: "SKIP",
          actorId: mob.playerId,
          message: `${mob.playerId} pulou o turno`,
        });
        continue;
      }

      // d. Resolver skill do mob
      const equipped = mob.equippedSkills.find((es) => es.skillId === skillId);
      if (!equipped) {
        events.push({
          turn: s.turnNumber,
          phase: "INVALID",
          actorId: mob.playerId,
          message: `${mob.playerId} tentou usar skill invalida`,
        });
        continue;
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
        continue;
      }

      const skill: Skill = equipped.skill;

      // Combo do mob
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
          const missTargetId = targetPlayerId ?? undefined;
          events.push({
            turn: s.turnNumber,
            phase: "MISS",
            actorId: mob.playerId,
            targetId: missTargetId,
            skillId: skill.id,
            skillName: skill.name,
            missed: true,
            message: `${mob.playerId} usou ${skill.name} mas errou!`,
          });
          putOnCooldown(mob, skill.id);
          mob.combo = { skillId: null, stacks: 0 };
          continue;
        }
      }

      // Determinar alvos do mob
      const mobTargets = resolveCoopPveMobTargets(s, mob, skill, targetPlayerId);

      // Resolver dano e efeitos por alvo
      for (const target of mobTargets) {
        if (target.currentHp <= 0) continue;

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
            damageType: skill.damageType,
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
        if (s.team.some((p) => p.playerId === target.playerId)) {
          const countersCopy = [...target.counters];
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
                actorId: target.playerId,
                targetId: mob.playerId,
                damage: counterDamage,
                damageType: skill.damageType,
                counterTriggered: true,
                message: `${target.playerId} contra-ataca ${mob.playerId} por ${counterDamage} de dano`,
              });

              if (counter.onTrigger) {
                applyCounterTriggerEffects(
                  counter.onTrigger,
                  target,
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

        // f. Se player morreu -> checar se todos mortos -> DEFEAT
        if (target.currentHp <= 0 && s.team.some((p) => p.playerId === target.playerId)) {
          events.push({
            turn: s.turnNumber,
            phase: "DEATH",
            targetId: target.playerId,
            message: `${target.playerId} foi derrotado`,
          });
          if (s.team.every((p) => p.currentHp <= 0)) {
            s.status = "FINISHED";
            s.result = "DEFEAT";
            events.push({
              turn: s.turnNumber,
              phase: "DEATH",
              message: "Todo o time foi derrotado. Os mobs vencem.",
            });
            break;
          }
        }

        // g. Se mob morreu por counter -> defeated
        if (mob.currentHp <= 0) {
          mob.defeated = true;
          events.push({
            turn: s.turnNumber,
            phase: "DEATH",
            targetId: mob.playerId,
            message: `${mob.playerId} foi derrotado por contra-ataque`,
          });
          break;
        }
      }

      // Aplicar efeitos da skill via adapter
      if (s.status !== "FINISHED" && !mob.defeated) {
        for (const target of mobTargets) {
          if (target.currentHp <= 0) continue;

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
        }
      }

      // Cooldown
      putOnCooldown(mob, skill.id);

      if (s.status === "FINISHED") break;
    }
  }

  // 6. Checar vitoria apos turno dos mobs
  if (s.status !== "FINISHED" && s.mobs.every((m) => m.defeated)) {
    s.status = "FINISHED";
    s.result = "VICTORY";
    events.push({
      turn: s.turnNumber,
      phase: "DEATH",
      message: "Todos os mobs foram derrotados! O time vence!",
    });
  }

  // 7. tickEntitiesEndOfTurn para [team vivos + mobs vivos]
  if (s.status !== "FINISHED") {
    const aliveEntities: PlayerState[] = [
      ...s.team.filter((p) => p.currentHp > 0),
      ...s.mobs.filter((m) => !m.defeated),
    ];
    tickEntitiesEndOfTurn(aliveEntities, s.turnNumber, events);

    // 8. tickCooldowns para cada entidade viva
    for (const player of s.team) {
      if (player.currentHp > 0) {
        tickCooldowns(player);
      }
    }
    for (const mob of s.mobs) {
      if (!mob.defeated) {
        tickCooldowns(mob);
      }
    }

    // 9. Checar mortes por ON_EXPIRE
    for (const player of s.team) {
      if (player.currentHp <= 0 && s.team.indexOf(player) >= 0) {
        // Player may have died from ON_EXPIRE effect
        // Only log if not already logged (check if already dead before tick)
      }
    }
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

    // Checar se todos players morreram por ON_EXPIRE
    if (s.team.every((p) => p.currentHp <= 0)) {
      s.status = "FINISHED";
      s.result = "DEFEAT";
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        message: "Todo o time foi derrotado por efeitos expirados.",
      });
    }

    // Checar vitoria por ON_EXPIRE
    if (s.status !== "FINISHED" && s.mobs.every((m) => m.defeated)) {
      s.status = "FINISHED";
      s.result = "VICTORY";
    }

    // 10. Incrementar turno
    if (s.status !== "FINISHED") {
      s.turnNumber += 1;

      // 11. Se turnNumber > MAX_TURNS -> DEFEAT
      if (s.turnNumber > MAX_TURNS) {
        s.status = "FINISHED";
        s.result = "DEFEAT";
        events.push({
          turn: s.turnNumber,
          phase: "DRAW",
          message: `Batalha coop PvE terminou em derrota apos ${MAX_TURNS} turnos`,
        });
      }
    }
  }

  // 12. Consolidar turnLog, retornar
  s.turnLog = [...s.turnLog, ...events];
  return { state: s, events };
}

// ---------------------------------------------------------------------------
// resolveCoopPvePlayerTargets — Determina alvos de uma skill de player
// ---------------------------------------------------------------------------

function resolveCoopPvePlayerTargets(
  s: CoopPveBattleState,
  player: PlayerState,
  skill: Skill,
  action: CoopPveAction
): PlayerState[] {
  const aliveMobs = s.mobs.filter((m) => !m.defeated);
  const aliveTeam = s.team.filter((p) => p.currentHp > 0);

  switch (skill.target) {
    case "SINGLE_ENEMY": {
      if (action.targetIndex !== undefined) {
        const targetMob = s.mobs[action.targetIndex];
        if (targetMob && !targetMob.defeated) {
          return [targetMob];
        }
        // Mob alvo ja foi derrotado neste turno — nao redirecionar para outro
        return [];
      }
      // Sem targetIndex — nao atacar
      return [];
    }

    case "ALL_ENEMIES":
      return aliveMobs;

    case "SELF":
      return [player];

    case "SINGLE_ALLY": {
      if (action.targetId) {
        const target = aliveTeam.find((p) => p.playerId === action.targetId);
        if (target) return [target];
      }
      return [player];
    }

    case "ALL_ALLIES":
      return aliveTeam;

    case "ALL":
      return [...aliveTeam, ...aliveMobs];

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// resolveCoopPveMobTargets — Determina alvos de uma skill de mob
// ---------------------------------------------------------------------------

function resolveCoopPveMobTargets(
  s: CoopPveBattleState,
  mob: MobState,
  skill: Skill,
  targetPlayerId: string | null
): PlayerState[] {
  const aliveTeam = s.team.filter((p) => p.currentHp > 0);
  const aliveMobs: PlayerState[] = s.mobs.filter((m) => !m.defeated);

  switch (skill.target) {
    case "SINGLE_ENEMY": {
      if (targetPlayerId) {
        const target = aliveTeam.find((p) => p.playerId === targetPlayerId);
        if (target) return [target];
      }
      // Fallback: primeiro player vivo
      return aliveTeam.length > 0 ? [aliveTeam[0]] : [];
    }

    case "ALL_ENEMIES":
      return aliveTeam;

    case "SELF":
      return [mob];

    case "SINGLE_ALLY":
      return [mob];

    case "ALL_ALLIES":
      return aliveMobs;

    case "ALL":
      return [...aliveMobs, ...aliveTeam];

    default:
      return aliveTeam;
  }
}
