import type { HabitCategory, HouseName } from "@prisma/client";

interface HabitWithCategory {
  category: HabitCategory;
}

/**
 * Ordem de prioridade para desempate entre categorias.
 * PHYSICAL > INTELLECTUAL > MENTAL > SOCIAL/SPIRITUAL
 */
const CATEGORY_PRIORITY: readonly HabitCategory[] = [
  "PHYSICAL",
  "INTELLECTUAL",
  "MENTAL",
  "SOCIAL",
  "SPIRITUAL",
] as const;

/**
 * Mapeamento de categoria dominante para casa.
 * SOCIAL e SPIRITUAL ambos levam a NEREID.
 */
const CATEGORY_TO_HOUSE: Record<HabitCategory, HouseName> = {
  PHYSICAL: "ARION",
  INTELLECTUAL: "LYCUS",
  MENTAL: "NOCTIS",
  SOCIAL: "NEREID",
  SPIRITUAL: "NEREID",
} as const;

/**
 * Determina a casa do jogador com base nos habitos selecionados.
 *
 * Regras:
 * - Conta a frequencia de cada categoria nos habitos fornecidos.
 * - A categoria com maior contagem define a casa.
 * - Em caso de empate, a prioridade e: PHYSICAL > INTELLECTUAL > MENTAL > SOCIAL > SPIRITUAL.
 * - SOCIAL e SPIRITUAL ambos mapeiam para NEREID.
 *
 * Funcao pura — nao acessa banco de dados.
 */
export function determineHouse(habits: HabitWithCategory[]): HouseName {
  const counts: Record<HabitCategory, number> = {
    PHYSICAL: 0,
    INTELLECTUAL: 0,
    MENTAL: 0,
    SOCIAL: 0,
    SPIRITUAL: 0,
  };

  for (const habit of habits) {
    counts[habit.category] += 1;
  }

  let dominantCategory: HabitCategory = "PHYSICAL";
  let maxCount = 0;

  for (const category of CATEGORY_PRIORITY) {
    if (counts[category] > maxCount) {
      maxCount = counts[category];
      dominantCategory = category;
    }
  }

  return CATEGORY_TO_HOUSE[dominantCategory];
}
