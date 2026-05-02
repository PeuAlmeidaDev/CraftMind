import { z } from "zod";

/** Filtro de casa para rankings individuais. */
export const houseFilterSchema = z.enum([
  "GLOBAL",
  "ARION",
  "LYCUS",
  "NOCTIS",
  "NEREID",
]);

export type HouseFilterInput = z.infer<typeof houseFilterSchema>;

/** Limite de entradas por pagina (1-100). */
export const limitSchema = z.coerce.number().int().min(1).max(100).default(50);

export type LimitInput = z.infer<typeof limitSchema>;

/** Periodo do Estandarte das Casas. */
export const seasonSchema = z.enum(["lifetime", "monthly", "weekly"]);

export type SeasonInput = z.infer<typeof seasonSchema>;

/** Schema combinado para query params dos rankings individuais. */
export const individualRankingQuerySchema = z.object({
  house: houseFilterSchema.default("GLOBAL"),
  limit: limitSchema,
});

export type IndividualRankingQuery = z.infer<
  typeof individualRankingQuerySchema
>;

/** Schema para query params do Estandarte das Casas. */
export const houseStandardQuerySchema = z.object({
  season: seasonSchema.default("lifetime"),
});

export type HouseStandardQuery = z.infer<typeof houseStandardQuerySchema>;
