// types/habit.ts — Habitos e categorias

export const HabitCategory = {
  PHYSICAL: "PHYSICAL",
  INTELLECTUAL: "INTELLECTUAL",
  MENTAL: "MENTAL",
  SOCIAL: "SOCIAL",
  SPIRITUAL: "SPIRITUAL",
} as const;

export type HabitCategory = (typeof HabitCategory)[keyof typeof HabitCategory];

/** Habito completo retornado por GET /api/habits */
export type Habit = {
  id: string;
  name: string;
  description: string;
  category: HabitCategory;
};

/** Habito resumido retornado dentro de respostas de auth (sem description) */
export type HabitSummary = {
  id: string;
  name: string;
  category: HabitCategory;
};
