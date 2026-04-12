// types/user.ts — Usuario publico e variantes

import type { House } from "./house";
import type { HabitSummary } from "./habit";

/** Dados publicos do usuario (sem passwordHash) */
export type UserPublic = {
  id: string;
  name: string;
  email: string;
};

/** Usuario com casa e habitos — retornado no register */
export type UserWithHouse = UserPublic & {
  house: House;
  habits: HabitSummary[];
};
