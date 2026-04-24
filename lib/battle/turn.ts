// lib/battle/turn.ts — Orquestrador principal de resolucao de turno

import type {
  BattleState,
  TurnAction,
  TurnResult,
  TurnLogEntry,
  Skill,
} from "./types";
import { deepClone, getPlayer, getOpponent, clampStage } from "./utils";
import { getEffectiveStat, calculateDamage } from "./damage";
import { getComboModifier, putOnCooldown, tickCooldowns } from "./skills";
import { isIncapacitated, applyStatusDamage, tickEndOfTurn } from "./status";
import { applyEffects } from "./effects";
import { MAX_TURNS, STAGE_MULTIPLIERS } from "./constants";
import { calculateExtraActions } from "./speed";
import { applyCounterTriggerEffects } from "./shared-helpers";

// ---------------------------------------------------------------------------
// Resolucao principal do turno
// ---------------------------------------------------------------------------

export function resolveTurn(
  state: BattleState,
  actions: [TurnAction, TurnAction],
  randomFn?: () => number
): TurnResult {
  // 0. Guard: batalha ja finalizada
  if (state.status === "FINISHED") {
    return { state, events: [] };
  }

  // 1. Deep clone
  const clonedState = deepClone(state);
  const events: TurnLogEntry[] = [];

  // 1b. Validar que os playerIds das acoes pertencem a batalha
  const validPlayerIds = new Set(clonedState.players.map((p) => p.playerId));
  if (
    !validPlayerIds.has(actions[0].playerId) ||
    !validPlayerIds.has(actions[1].playerId) ||
    actions[0].playerId === actions[1].playerId
  ) {
    throw new Error(
      `Acoes invalidas: playerIds [${actions[0].playerId}, ${actions[1].playerId}] nao correspondem aos jogadores da batalha [${[...validPlayerIds].join(", ")}]`
    );
  }

  // 2. Determinar ordem de acao
  type ActionWithPriority = {
    action: TurnAction;
    effectiveSpeed: number;
    prioritySum: number;
  };

  const actionPriorities: ActionWithPriority[] = actions.map((action) => {
    const player = getPlayer(clonedState, action.playerId);
    const effectiveSpeed = getEffectiveStat(
      player.baseStats.speed,
      player.stages.speed
    );
    const prioritySum = player.buffs
      .filter((b) => b.stat === "priority")
      .reduce((sum, b) => sum + b.value, 0);

    return { action, effectiveSpeed, prioritySum };
  });

  // Ordenar: maior prioridade primeiro, empate por speed, empate total por random
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

  // 2b. Calcular acoes extras por vantagem de speed
  const speedA = actionPriorities[0].effectiveSpeed;
  const speedB = actionPriorities[1].effectiveSpeed;
  const { extraA, extraB } = calculateExtraActions(
    actionPriorities[0].effectiveSpeed,
    actionPriorities[1].effectiveSpeed
  );

  // Montar array: mais rapido age primeiro, com extras logo apos, depois o mais lento
  const orderedActions: TurnAction[] = [];
  const fastAction = actionPriorities[0].action;
  const slowAction = actionPriorities[1].action;
  const fastExtras = extraA; // actionPriorities[0] is the faster (sorted)
  const slowExtras = extraB;

  // Fast player actions (1 + extras)
  for (let i = 0; i < 1 + fastExtras; i++) {
    orderedActions.push(fastAction);
  }
  // Slow player actions (1 + extras — typically 0 extras)
  for (let i = 0; i < 1 + slowExtras; i++) {
    orderedActions.push(slowAction);
  }

  // Log speed advantage
  if (fastExtras > 0) {
    events.push({
      turn: clonedState.turnNumber,
      phase: "SPEED_ADVANTAGE",
      actorId: fastAction.playerId,
      message: `${fastAction.playerId} ganha ${fastExtras} acao(oes) extra(s) por vantagem de speed (${speedA} vs ${speedB})`,
    });
  }
  if (slowExtras > 0) {
    events.push({
      turn: clonedState.turnNumber,
      phase: "SPEED_ADVANTAGE",
      actorId: slowAction.playerId,
      message: `${slowAction.playerId} ganha ${slowExtras} acao(oes) extra(s) por vantagem de speed (${speedB} vs ${speedA})`,
    });
  }

  // 3. Resolver cada acao na ordem
  for (const action of orderedActions) {
    const playerState = getPlayer(clonedState, action.playerId);
    const opponentState = getOpponent(clonedState, action.playerId);

    // b. Se batalha ja acabou: skip
    if (clonedState.status === "FINISHED") continue;

    // c. Checar incapacitacao
    const incap = isIncapacitated(playerState);
    if (incap.incapacitated) {
      playerState.combo = { skillId: null, stacks: 0 };
      events.push({
        turn: clonedState.turnNumber,
        phase: "INCAPACITATED",
        actorId: playerState.playerId,
        message: `${playerState.playerId} esta incapacitado por ${incap.reason}`,
      });
      continue;
    }

    // d. Aplicar dano de status no ator
    const statusEntries = applyStatusDamage(
      playerState,
      clonedState.turnNumber
    );
    events.push(...statusEntries);

    if (playerState.currentHp <= 0) {
      clonedState.status = "FINISHED";
      clonedState.winnerId = opponentState.playerId;
      events.push({
        turn: clonedState.turnNumber,
        phase: "DEATH",
        targetId: playerState.playerId,
        message: `${playerState.playerId} foi derrotado por dano de status`,
      });
      continue;
    }

    // e. Validar skill
    if (action.skillId === null) {
      events.push({
        turn: clonedState.turnNumber,
        phase: "SKIP",
        actorId: playerState.playerId,
        message: `${playerState.playerId} pulou o turno`,
      });
      continue;
    }

    const equipped = playerState.equippedSkills.find(
      (es) => es.skillId === action.skillId
    );
    if (!equipped) {
      events.push({
        turn: clonedState.turnNumber,
        phase: "INVALID",
        actorId: playerState.playerId,
        skillId: action.skillId,
        message: `${playerState.playerId} tentou usar skill invalida`,
      });
      continue;
    }

    if (
      playerState.cooldowns[action.skillId] &&
      playerState.cooldowns[action.skillId] > 0
    ) {
      events.push({
        turn: clonedState.turnNumber,
        phase: "COOLDOWN",
        actorId: playerState.playerId,
        skillId: action.skillId,
        skillName: equipped.skill.name,
        message: `${playerState.playerId} tentou usar ${equipped.skill.name} mas esta em cooldown`,
      });
      continue;
    }

    const skill: Skill = equipped.skill;

    // f. Resolver combo
    let comboOverride: { basePower: number; hits: number } | undefined;
    const comboResult = getComboModifier(playerState, skill);
    if (comboResult !== null) {
      playerState.combo = comboResult.newCombo;
      comboOverride = {
        basePower: comboResult.basePower,
        hits: comboResult.hits,
      };
      events.push({
        turn: clonedState.turnNumber,
        phase: "COMBO",
        actorId: playerState.playerId,
        skillId: skill.id,
        skillName: skill.name,
        comboStack: comboResult.newCombo.stacks,
        message: `${playerState.playerId} usa ${skill.name} em combo (stack ${comboResult.newCombo.stacks})`,
      });
    } else {
      playerState.combo = { skillId: action.skillId, stacks: 0 };
    }

    // f2. Check de accuracy
    const isSupportSelf =
      skill.damageType === "NONE" &&
      skill.basePower === 0 &&
      skill.target === "SELF";

    if (!isSupportSelf) {
      const stageMultiplier = STAGE_MULTIPLIERS[clampStage(playerState.stages.accuracy)];
      const hitChance = Math.min(100, Math.max(10, skill.accuracy * stageMultiplier));
      const hit = (randomFn ?? Math.random)() * 100 < hitChance;

      if (!hit) {
        events.push({
          turn: clonedState.turnNumber,
          phase: "MISS",
          actorId: playerState.playerId,
          targetId: opponentState.playerId,
          skillId: skill.id,
          skillName: skill.name,
          missed: true,
          message: `${playerState.playerId} usou ${skill.name} mas errou!`,
        });

        // Cooldown e reset de combo ainda acontecem no miss
        putOnCooldown(playerState, skill.id);
        playerState.combo = { skillId: null, stacks: 0 };
        continue;
      }
    }

    // g. Calcular dano
    const dmgResult = calculateDamage({
      skill,
      attacker: playerState,
      defender: opponentState,
      comboOverride,
      randomFn,
    });

    if (dmgResult.totalDamage > 0) {
      opponentState.currentHp = Math.max(
        0,
        opponentState.currentHp - dmgResult.totalDamage
      );
      events.push({
        turn: clonedState.turnNumber,
        phase: "DAMAGE",
        actorId: playerState.playerId,
        targetId: opponentState.playerId,
        skillId: skill.id,
        skillName: skill.name,
        damage: dmgResult.totalDamage,
        message: `${playerState.playerId} usa ${skill.name} e causa ${dmgResult.totalDamage} de dano (${dmgResult.hits} hit${dmgResult.hits > 1 ? "s" : ""})`,
      });
    } else {
      events.push({
        turn: clonedState.turnNumber,
        phase: "ACTION",
        actorId: playerState.playerId,
        targetId: opponentState.playerId,
        skillId: skill.id,
        skillName: skill.name,
        message: `${playerState.playerId} usa ${skill.name}`,
      });
    }

    // h. Checar counter no defensor
    const countersCopy = [...opponentState.counters];
    for (const counter of countersCopy) {
      if (counter.remainingTurns > 0 && dmgResult.totalDamage > 0) {
        const counterDamage = Math.max(
          1,
          Math.floor(dmgResult.totalDamage * counter.powerMultiplier)
        );
        playerState.currentHp = Math.max(
          0,
          playerState.currentHp - counterDamage
        );
        events.push({
          turn: clonedState.turnNumber,
          phase: "COUNTER",
          actorId: opponentState.playerId,
          targetId: playerState.playerId,
          damage: counterDamage,
          counterTriggered: true,
          message: `${opponentState.playerId} contra-ataca ${playerState.playerId} por ${counterDamage} de dano`,
        });

        if (counter.onTrigger) {
          applyCounterTriggerEffects(
            counter.onTrigger,
            opponentState,
            playerState,
            clonedState.turnNumber,
            events,
            randomFn
          );
        }

        // Apenas o primeiro counter ativo
        break;
      }
    }

    // i. Aplicar efeitos
    const effectEntries = applyEffects({
      skill,
      casterId: playerState.playerId,
      state: clonedState,
      totalDamage: dmgResult.totalDamage,
      turnNumber: clonedState.turnNumber,
      randomFn,
    });
    events.push(...effectEntries);

    // j. Colocar skill em cooldown
    putOnCooldown(playerState, skill.id);

    // k. Checar fim de batalha
    if (opponentState.currentHp <= 0 && playerState.currentHp <= 0) {
      clonedState.status = "FINISHED";
      // Quem agiu sobrevive (tem a vantagem de ter agido)
      clonedState.winnerId = playerState.playerId;
      events.push({
        turn: clonedState.turnNumber,
        phase: "DEATH",
        targetId: opponentState.playerId,
        message: `${opponentState.playerId} foi derrotado`,
      });
      events.push({
        turn: clonedState.turnNumber,
        phase: "DEATH",
        targetId: playerState.playerId,
        message: `${playerState.playerId} tambem caiu, mas vence por ter agido primeiro`,
      });
    } else if (opponentState.currentHp <= 0) {
      clonedState.status = "FINISHED";
      clonedState.winnerId = playerState.playerId;
      events.push({
        turn: clonedState.turnNumber,
        phase: "DEATH",
        targetId: opponentState.playerId,
        message: `${opponentState.playerId} foi derrotado`,
      });
    } else if (playerState.currentHp <= 0) {
      clonedState.status = "FINISHED";
      clonedState.winnerId = opponentState.playerId;
      events.push({
        turn: clonedState.turnNumber,
        phase: "DEATH",
        targetId: playerState.playerId,
        message: `${playerState.playerId} foi derrotado`,
      });
    }
  }

  // 4. Apos ambos jogadores agirem
  tickEndOfTurn(clonedState, events);
  tickCooldowns(clonedState.players[0]);
  tickCooldowns(clonedState.players[1]);

  // Checar fim de batalha novamente (ON_EXPIRE pode ter matado alguem)
  if (clonedState.status !== "FINISHED") {
    const p1 = clonedState.players[0];
    const p2 = clonedState.players[1];

    if (p1.currentHp <= 0 && p2.currentHp <= 0) {
      clonedState.status = "FINISHED";
      clonedState.winnerId = p2.playerId; // segundo jogador sobrevive por convencao
    } else if (p1.currentHp <= 0) {
      clonedState.status = "FINISHED";
      clonedState.winnerId = p2.playerId;
    } else if (p2.currentHp <= 0) {
      clonedState.status = "FINISHED";
      clonedState.winnerId = p1.playerId;
    }
  }

  if (clonedState.status === "IN_PROGRESS") {
    clonedState.turnNumber += 1;
  }

  if (clonedState.status === "IN_PROGRESS" && clonedState.turnNumber > MAX_TURNS) {
    clonedState.status = "FINISHED";
    clonedState.winnerId = null;
    events.push({
      turn: clonedState.turnNumber,
      phase: "DRAW",
      message: `Batalha terminou em empate apos ${MAX_TURNS} turnos`,
    });
  }

  // 5. Consolidar log e retornar
  clonedState.turnLog = [...clonedState.turnLog, ...events];
  return { state: clonedState, events };
}
