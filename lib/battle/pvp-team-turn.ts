// lib/battle/pvp-team-turn.ts — Engine para batalha PvP Team 2v2

import type {
  BattleState,
  TurnLogEntry,
  PlayerState,
  Skill,
} from "./types";
import type {
  PvpTeamBattleState,
  PvpTeamAction,
  PvpTeamTurnResult,
  PvpTeamBattleConfig,
} from "./pvp-team-types";
import { clampStage, deepClone } from "./utils";
import { getEffectiveStat, calculateDamage } from "./damage";
import { getComboModifier, putOnCooldown, tickCooldowns } from "./skills";
import { isIncapacitated, applyStatusDamage } from "./status";
import { applyEffects } from "./effects";
import { MAX_TURNS, STAGE_MULTIPLIERS } from "./constants";
import {
  createPlayerState,
  applyCounterTriggerEffects,
  tickEntitiesEndOfTurn,
} from "./shared-helpers";

// ---------------------------------------------------------------------------
// Helper: criar BattleState fake para adaptar funcoes existentes (applyEffects)
// ---------------------------------------------------------------------------

const DUMMY_PLAYER_ID = "__pvp_team_dummy__";

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
// Helper: encontrar time e time oposto de um jogador
// ---------------------------------------------------------------------------

function getPlayerTeam(s: PvpTeamBattleState, playerId: string): { own: PlayerState[]; enemy: PlayerState[]; teamNum: 1 | 2 } | null {
  if (s.team1.some((p) => p.playerId === playerId)) {
    return { own: s.team1, enemy: s.team2, teamNum: 1 };
  }
  if (s.team2.some((p) => p.playerId === playerId)) {
    return { own: s.team2, enemy: s.team1, teamNum: 2 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// initPvpTeamBattle
// ---------------------------------------------------------------------------

export function initPvpTeamBattle(config: PvpTeamBattleConfig): PvpTeamBattleState {
  if (config.team1.length !== 2) {
    throw new Error(`Team 1 deve ter 2 jogadores (recebeu ${config.team1.length})`);
  }
  if (config.team2.length !== 2) {
    throw new Error(`Team 2 deve ter 2 jogadores (recebeu ${config.team2.length})`);
  }

  const team1States = config.team1.map((p) => createPlayerState(p));
  const team2States = config.team2.map((p) => createPlayerState(p));

  return {
    battleId: config.battleId,
    turnNumber: 1,
    team1: team1States,
    team2: team2States,
    mode: config.mode,
    turnLog: [],
    status: "IN_PROGRESS",
    winnerTeam: null,
  };
}

// ---------------------------------------------------------------------------
// resolvePvpTeamTurn
// ---------------------------------------------------------------------------

export function resolvePvpTeamTurn(
  state: PvpTeamBattleState,
  actions: PvpTeamAction[],
  randomFn?: () => number
): PvpTeamTurnResult {
  // 0. Guard: batalha ja finalizada
  if (state.status === "FINISHED") {
    return { state, events: [] };
  }

  // 1. Deep clone
  const s: PvpTeamBattleState = deepClone(state);
  const events: TurnLogEntry[] = [];

  // 2. Coletar todos jogadores vivos
  const allPlayers = [...s.team1, ...s.team2];
  const alivePlayers = allPlayers.filter((p) => p.currentHp > 0);
  const alivePlayerIds = new Set(alivePlayers.map((p) => p.playerId));

  // 3. Validar acoes (1 por player vivo, ou null para skip)
  const validActions = actions.filter((a) => alivePlayerIds.has(a.playerId));
  const actionPlayerIds = new Set(validActions.map((a) => a.playerId));
  if (actionPlayerIds.size !== validActions.length) {
    throw new Error("Acoes duplicadas: cada jogador deve enviar exatamente 1 acao");
  }

  // Preencher acoes faltantes como skip
  for (const player of alivePlayers) {
    if (!actionPlayerIds.has(player.playerId)) {
      validActions.push({ playerId: player.playerId, skillId: null });
    }
  }

  // 4. Ordenar por prioridade > speed > random
  const sortedActions = [...validActions].sort((a, b) => {
    const playerA = allPlayers.find((p) => p.playerId === a.playerId);
    const playerB = allPlayers.find((p) => p.playerId === b.playerId);
    if (!playerA || !playerB) return 0;

    // Priority: checar buffs de PRIORITY_SHIFT
    const priorityA = playerA.buffs
      .filter((bf) => bf.stat === "priority")
      .reduce((sum, bf) => sum + bf.value, 0);
    const priorityB = playerB.buffs
      .filter((bf) => bf.stat === "priority")
      .reduce((sum, bf) => sum + bf.value, 0);
    if (priorityA !== priorityB) return priorityB - priorityA;

    // Speed
    const speedA = getEffectiveStat(playerA.baseStats.speed, playerA.stages.speed);
    const speedB = getEffectiveStat(playerB.baseStats.speed, playerB.stages.speed);
    if (speedA !== speedB) return speedB - speedA;

    // Random tiebreak
    return (randomFn ?? Math.random)() > 0.5 ? -1 : 1;
  });

  // 5. Resolver cada acao
  for (const action of sortedActions) {
    if (s.status === "FINISHED") break;

    const player = allPlayers.find((p) => p.playerId === action.playerId);
    if (!player || player.currentHp <= 0) continue;

    const teams = getPlayerTeam(s, player.playerId);
    if (!teams) continue;

    // a. Checar incapacitacao
    const incap = isIncapacitated(player);

    // b. Aplicar dano de status
    const statusEntries = applyStatusDamage(player, s.turnNumber);
    events.push(...statusEntries);

    // c. Se morreu por status
    if (player.currentHp <= 0) {
      events.push({
        turn: s.turnNumber,
        phase: "DEATH",
        targetId: player.playerId,
        message: `${player.playerId} foi derrotado por dano de status`,
      });
      checkTeamWipe(s, events);
      continue;
    }

    // d. Se incapacitado ou skip
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

    // e. Validar skill
    const equipped = player.equippedSkills.find((es) => es.skillId === action.skillId);
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

    // f. Combo
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

    // g. Accuracy check
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

    // h. Resolver alvos
    const targets = resolvePvpTeamTargets(s, player, skill, action, teams);

    // i. Para cada alvo: dano, counters, checar mortes
    for (const target of targets) {
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
          break;
        }
      }

      // Checar se alvo morreu
      if (target.currentHp <= 0) {
        events.push({
          turn: s.turnNumber,
          phase: "DEATH",
          targetId: target.playerId,
          message: `${target.playerId} foi derrotado`,
        });
        checkTeamWipe(s, events);
      }

      // Checar se player morreu por counter
      if (player.currentHp <= 0) {
        events.push({
          turn: s.turnNumber,
          phase: "DEATH",
          targetId: player.playerId,
          message: `${player.playerId} foi derrotado por contra-ataque`,
        });
        checkTeamWipe(s, events);
        break;
      }
    }

    // j. Aplicar efeitos via adapter
    if ((s.status as string) !== "FINISHED" && player.currentHp > 0) {
      for (const target of targets) {
        if (target.currentHp <= 0) continue;

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

    // k. Cooldown
    putOnCooldown(player, skill.id);

    if ((s.status as string) === "FINISHED") break;
  }

  // 6. Tick end of turn
  if (s.status !== "FINISHED") {
    const aliveEntities = allPlayers.filter((p) => p.currentHp > 0);
    tickEntitiesEndOfTurn(aliveEntities, s.turnNumber, events);

    // tickCooldowns
    for (const player of allPlayers) {
      if (player.currentHp > 0) {
        tickCooldowns(player);
      }
    }

    // Checar mortes por ON_EXPIRE
    checkTeamWipe(s, events);

    // 7. Incrementar turno
    if ((s.status as string) !== "FINISHED") {
      s.turnNumber += 1;

      if (s.turnNumber > MAX_TURNS) {
        s.status = "FINISHED";
        s.winnerTeam = null; // empate
        events.push({
          turn: s.turnNumber,
          phase: "DRAW",
          message: `Batalha PvP Team terminou em empate apos ${MAX_TURNS} turnos`,
        });
      }
    }
  }

  // 8. Consolidar turnLog
  s.turnLog = [...s.turnLog, ...events];
  return { state: s, events };
}

// ---------------------------------------------------------------------------
// checkTeamWipe — Verifica se todos de um time morreram
// ---------------------------------------------------------------------------

function checkTeamWipe(s: PvpTeamBattleState, events: TurnLogEntry[]): void {
  if (s.status === "FINISHED") return;

  const team1AllDead = s.team1.every((p) => p.currentHp <= 0);
  const team2AllDead = s.team2.every((p) => p.currentHp <= 0);

  if (team1AllDead && team2AllDead) {
    s.status = "FINISHED";
    s.winnerTeam = null; // empate (ambos morreram)
    events.push({
      turn: s.turnNumber,
      phase: "DRAW",
      message: "Ambos os times foram eliminados. Empate!",
    });
  } else if (team1AllDead) {
    s.status = "FINISHED";
    s.winnerTeam = 2;
    events.push({
      turn: s.turnNumber,
      phase: "DEATH",
      message: "Time 1 foi eliminado. Time 2 vence!",
    });
  } else if (team2AllDead) {
    s.status = "FINISHED";
    s.winnerTeam = 1;
    events.push({
      turn: s.turnNumber,
      phase: "DEATH",
      message: "Time 2 foi eliminado. Time 1 vence!",
    });
  }
}

// ---------------------------------------------------------------------------
// resolvePvpTeamTargets — Determina alvos de uma skill em PvP Team
// ---------------------------------------------------------------------------

function resolvePvpTeamTargets(
  _s: PvpTeamBattleState,
  player: PlayerState,
  skill: Skill,
  action: PvpTeamAction,
  teams: { own: PlayerState[]; enemy: PlayerState[]; teamNum: 1 | 2 }
): PlayerState[] {
  const aliveOwn = teams.own.filter((p) => p.currentHp > 0);
  const aliveEnemy = teams.enemy.filter((p) => p.currentHp > 0);

  switch (skill.target) {
    case "SINGLE_ENEMY": {
      if (action.targetIndex !== undefined) {
        const target = teams.enemy[action.targetIndex];
        if (target && target.currentHp > 0) return [target];
        // Alvo morreu — nao redirecionar
        return [];
      }
      // Fallback: primeiro inimigo vivo
      return aliveEnemy.length > 0 ? [aliveEnemy[0]] : [];
    }

    case "ALL_ENEMIES":
      return aliveEnemy;

    case "SELF":
      return [player];

    case "SINGLE_ALLY": {
      if (action.targetId) {
        const target = aliveOwn.find((p) => p.playerId === action.targetId);
        if (target) return [target];
      }
      // Fallback: si mesmo
      return [player];
    }

    case "ALL_ALLIES":
      return aliveOwn;

    case "ALL":
      return [...aliveOwn, ...aliveEnemy];

    default:
      return [];
  }
}
