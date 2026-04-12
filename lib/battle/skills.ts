// lib/battle/skills.ts — Gerenciamento de skills e combos

import type { Skill, PlayerState, EquippedSkill, ComboState } from "./types";

export function getAvailableSkills(player: PlayerState): EquippedSkill[] {
  return player.equippedSkills.filter(
    (es) => !player.cooldowns[es.skillId] || player.cooldowns[es.skillId] <= 0
  );
}

export function putOnCooldown(player: PlayerState, skillId: string): void {
  const equipped = player.equippedSkills.find((es) => es.skillId === skillId);
  if (equipped && equipped.skill.cooldown > 0) {
    // +1 para compensar o tickCooldowns que ocorre no fim do mesmo turno
    player.cooldowns[skillId] = equipped.skill.cooldown + 1;
  }
}

export function tickCooldowns(player: PlayerState): void {
  for (const skillId of Object.keys(player.cooldowns)) {
    player.cooldowns[skillId] -= 1;
    if (player.cooldowns[skillId] <= 0) {
      delete player.cooldowns[skillId];
    }
  }
}

export function getComboModifier(
  player: PlayerState,
  skill: Skill
): { basePower: number; hits: number; newCombo: ComboState } | null {
  const comboEffect = skill.effects.find((e) => e.type === "COMBO");
  if (!comboEffect || comboEffect.type !== "COMBO") {
    return null;
  }

  let newStacks: number;
  if (skill.id === player.combo.skillId) {
    newStacks = Math.min(player.combo.stacks + 1, comboEffect.maxStacks);
  } else {
    newStacks = 1;
  }

  const escalationIndex = Math.min(
    newStacks - 1,
    comboEffect.escalation.length - 1
  );
  const escalation = comboEffect.escalation[escalationIndex];

  return {
    basePower: escalation.basePower,
    hits: escalation.hits,
    newCombo: { skillId: skill.id, stacks: newStacks },
  };
}
