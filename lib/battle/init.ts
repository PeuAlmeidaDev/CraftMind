// lib/battle/init.ts — Inicializacao do estado de batalha

import type {
  BattleState,
  PlayerState,
  InitBattleConfig,
  BattlePlayerConfig,
} from "./types";

function createPlayerState(config: BattlePlayerConfig): PlayerState {
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

export function initBattle(config: InitBattleConfig): BattleState {
  const player1State = createPlayerState(config.player1);
  const player2State = createPlayerState(config.player2);

  return {
    battleId: config.battleId,
    turnNumber: 1,
    players: [player1State, player2State],
    turnLog: [],
    status: "IN_PROGRESS",
    winnerId: null,
  };
}
