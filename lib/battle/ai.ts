// lib/battle/ai.ts — Escolha de acao da IA para mobs PvE

import type { BattleState, TurnAction } from "./types";
import type { AiProfile } from "./ai-profiles";
import { getPlayer, getOpponent } from "./utils";
import { getAvailableSkills } from "./skills";
import { scoreSkill } from "./ai-scoring";

export function chooseAction(params: {
  state: BattleState;
  mobPlayerId: string;
  profile: AiProfile;
  randomFn?: () => number;
}): TurnAction {
  const { state, mobPlayerId, profile, randomFn } = params;

  const mob = getPlayer(state, mobPlayerId);
  const opponent = getOpponent(state, mobPlayerId);
  const available = getAvailableSkills(mob);

  // Sem skills disponiveis: skip turn
  if (available.length === 0) {
    return { playerId: mobPlayerId, skillId: null };
  }

  // Pontuar cada skill e escolher a melhor
  let bestSkillId = available[0].skillId;
  let bestScore = -Infinity;

  for (const es of available) {
    const score = scoreSkill({
      skill: es.skill,
      mob,
      opponent,
      profile,
      comboState: mob.combo,
      randomFn,
    });

    if (score > bestScore) {
      bestScore = score;
      bestSkillId = es.skillId;
    }
  }

  return { playerId: mobPlayerId, skillId: bestSkillId };
}
