// lib/battle/coop-turn.ts — Orquestrador de turno para batalha cooperativa (Boss Fight 3v1)

import type {
  BattleState,
  TurnLogEntry,
  PlayerState,
  Skill,
} from "./types";
import type {
  CoopBattleState,
  CoopTurnAction,
  CoopTurnResult,
  CoopBossBattleConfig,
} from "./coop-types";
import { deepClone, clampStage } from "./utils";
import { getEffectiveStat, calculateDamage } from "./damage";
import { getComboModifier, putOnCooldown, tickCooldowns } from "./skills";
import { isIncapacitated, applyStatusDamage } from "./status";
import { applyEffects } from "./effects";
import { chooseAction } from "./ai";
import { chooseBossTarget, resolveCoopTargets } from "./coop-target";
import { MAX_TURNS, STAGE_MULTIPLIERS } from "./constants";
import {
  createPlayerState,
  applyCounterTriggerEffects,
  tickEntitiesEndOfTurn,
} from "./shared-helpers";

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

// Dummy opponent used when caster === target (SELF skills) to satisfy
// getOpponent() which requires two distinct playerIds in the BattleState tuple.
const DUMMY_PLAYER_ID = "__coop_dummy__";

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
  // If both entities are the same (SELF target), use a dummy as opponent
  // so that getPlayer/getOpponent don't fail on duplicate IDs
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
          damageType: skill.damageType,
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
            damageType: skill.damageType,
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

  // 7. tickEndOfTurn para todas as entidades
  tickEntitiesEndOfTurn(
    [clonedState.boss, ...clonedState.team],
    clonedState.turnNumber,
    events
  );

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
