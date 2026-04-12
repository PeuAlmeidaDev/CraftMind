// types/task.ts — Tarefas diarias

import type { HabitCategory } from "./habit";
import type { AttributeGrants, Character } from "./character";

/** Tarefa diaria retornada por GET /api/tasks/daily */
export type DailyTask = {
  id: string;
  description: string;
  tag: string;
  habitName: string;
  habitCategory: HabitCategory;
  attributeGrants: AttributeGrants;
  completed: boolean;
  completedAt: string | null;
};

/** Tarefa completada retornada dentro de CompleteTaskResponse */
export type CompletedTask = {
  id: string;
  description: string;
  completed: boolean;
  completedAt: string;
  attributeGrants: AttributeGrants;
  habit: {
    name: string;
    category: HabitCategory;
  };
};

/** Subset de Skill retornado ao desbloquear uma skill via tarefa */
export type UnlockedSkillInfo = {
  id: string;
  name: string;
  description: string;
  tier: number;
};

/** Payload de data retornado por POST /api/tasks/[id]/complete */
export type CompleteTaskResult = {
  task: CompletedTask;
  attributesGained: AttributeGrants;
  character: Character;
  unlockedSkill?: UnlockedSkillInfo | null;
};

/** Resposta completa de POST /api/tasks/[id]/complete */
export type CompleteTaskResponse = {
  data: CompleteTaskResult;
  message: string;
};

/** Dia do calendario de atividade */
export type CalendarDay = {
  date: string;
  completed: number;
  total: number;
};
