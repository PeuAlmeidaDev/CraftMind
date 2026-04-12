// types/character.ts — Personagem e atributos

import type { StatName } from "@/types/skill";

/** Atributos do personagem retornados pela API */
export type Character = {
  id: string;
  physicalAtk: number;
  physicalDef: number;
  magicAtk: number;
  magicDef: number;
  hp: number;
  speed: number;
  level: number;
  currentExp: number;
  freePoints: number;
};

/** Stats que podem receber pontos livres (exclui accuracy) */
export type DistributableStat = Exclude<StatName, "accuracy">;

/** Distribuicao de pontos livres pelo jogador */
export type PointDistribution = Partial<Record<DistributableStat, number>>;

/**
 * Chaves do JSON attributeGrants usado em DailyTask e Habit.
 * Todas as chaves sao opcionais — apenas atributos com valor > 0 sao incluidos.
 */
export type AttributeGrants = {
  physicalAttack?: number;
  physicalDefense?: number;
  magicAttack?: number;
  magicDefense?: number;
  hp?: number;
  speed?: number;
};
