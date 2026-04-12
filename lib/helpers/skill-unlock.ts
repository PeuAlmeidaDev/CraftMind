/**
 * Logica de desbloqueio de skills ao completar tarefas diarias.
 *
 * A chance de desbloqueio depende da tag da tarefa completada.
 * Funcao pura — nao acessa banco de dados.
 */

import type { TaskTag } from "@/types/skill";

/** Chance de desbloqueio por tag (0 a 1) */
export const SKILL_UNLOCK_CHANCE: Record<TaskTag, number> = {
  LEARN: 0.18,
  APPLY: 0.11,
  REFLECT: 0.07,
  PRACTICE: 0.04,
  CONNECT: 0.07,
} as const;

const VALID_TAGS = new Set<string>(Object.keys(SKILL_UNLOCK_CHANCE));

/**
 * Rola a chance de desbloqueio de skill com base na tag da tarefa.
 *
 * Retorna true se o jogador desbloqueou uma skill nesta completacao.
 * Se a tag for null ou invalida, retorna false (chance zero).
 */
export function rollSkillUnlock(tag: string | null): boolean {
  if (tag === null || !VALID_TAGS.has(tag)) {
    return false;
  }

  const chance = SKILL_UNLOCK_CHANCE[tag as TaskTag];
  return Math.random() < chance;
}
