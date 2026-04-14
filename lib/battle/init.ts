// lib/battle/init.ts — Inicializacao do estado de batalha

import type {
  BattleState,
  InitBattleConfig,
} from "./types";
import { createPlayerState } from "./shared-helpers";

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
