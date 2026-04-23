// lib/validations/battle.ts — Schemas Zod para rotas de batalha PvE

import { z } from "zod";

export const pveBattleActionSchema = z.object({
  battleId: z.string().min(1, "battleId e obrigatorio"),
  skillId: z.string().nullable(),
});

const distributableStat = z.enum([
  "physicalAtk",
  "physicalDef",
  "magicAtk",
  "magicDef",
  "hp",
  "speed",
]);

export const distributePointsSchema = z.object({
  distribution: z
    .record(
      distributableStat,
      z.number().int("valor deve ser inteiro").positive("valor deve ser positivo")
    )
    .refine(
      (obj) => Object.keys(obj).length > 0,
      "Distribua pelo menos 1 ponto"
    ),
});

export const pveForfeitSchema = z.object({
  battleId: z.string().min(1, "battleId e obrigatorio"),
});

export type PveBattleActionInput = z.infer<typeof pveBattleActionSchema>;
export type DistributePointsInput = z.infer<typeof distributePointsSchema>;
export type PveForfeitInput = z.infer<typeof pveForfeitSchema>;
