// lib/validations/cards.ts — Schemas Zod para Cristais de Memoria.
//
// - cardEffectSchema: valida cada CardEffect individual (discriminated union por `type`).
// - cardEffectsArraySchema: valida o array completo de effects de uma Card.
// - equipCardSchema: payload de POST /api/cards/equip.
// - unequipCardSchema: payload de POST /api/cards/unequip.

import { z } from "zod";

// ---------------------------------------------------------------------------
// CardEffect (discriminated union)
// ---------------------------------------------------------------------------

// Nota: accuracy NAO esta aqui de proposito. Cartas com accuracy nao tem efeito
// em combate (accuracy e resolvida via stages, nao via BaseStats). Bloqueamos a
// criacao/edicao no admin para evitar confusao.
const statName = z.enum([
  "physicalAtk",
  "physicalDef",
  "magicAtk",
  "magicDef",
  "hp",
  "speed",
]);

const statusEffect = z.enum(["STUN", "FROZEN", "BURN", "POISON", "SLOW"]);

const statFlatSchema = z.object({
  type: z.literal("STAT_FLAT"),
  stat: statName,
  value: z.number().int("value deve ser inteiro"),
});

const statPercentSchema = z.object({
  type: z.literal("STAT_PERCENT"),
  stat: statName,
  percent: z.number().int("percent deve ser inteiro"),
});

const triggerSchema = z.object({
  type: z.literal("TRIGGER"),
  trigger: z.string().min(1, "trigger e obrigatorio"),
  payload: z.record(z.string(), z.unknown()),
});

const statusResistSchema = z.object({
  type: z.literal("STATUS_RESIST"),
  status: statusEffect,
  percent: z.number().int().min(0, "percent deve ser >= 0").max(100, "percent deve ser <= 100"),
});

export const cardEffectSchema = z.discriminatedUnion("type", [
  statFlatSchema,
  statPercentSchema,
  triggerSchema,
  statusResistSchema,
]);

export const cardEffectsArraySchema = z.array(cardEffectSchema);

export type CardEffectInput = z.infer<typeof cardEffectSchema>;

// ---------------------------------------------------------------------------
// Variantes (requiredStars + dropChance)
// ---------------------------------------------------------------------------
//
// requiredStars: estrela minima do encontro PvE para esta variante ser elegivel
//   ao drop (1, 2 ou 3). Combinada com `mobId` forma a constraint unica
//   `[mobId, requiredStars]` no Prisma — cada mob tem no maximo 3 variantes.
//
// dropChance: percentual individual de drop quando a variante e elegivel
//   (0 a 100, decimais permitidos). Default no banco e 5%.

export const requiredStarsSchema = z
  .number()
  .int("requiredStars deve ser inteiro")
  .min(1, "requiredStars minimo e 1")
  .max(3, "requiredStars maximo e 3");

export const dropChanceSchema = z
  .number()
  .min(0, "dropChance deve ser >= 0")
  .max(100, "dropChance deve ser <= 100");

// ---------------------------------------------------------------------------
// Card create / update (admin)
// ---------------------------------------------------------------------------

const rarityEnum = z.enum(["COMUM", "INCOMUM", "RARO", "EPICO", "LENDARIO"]);

export const cardCreateSchema = z.object({
  mobId: z.string().min(1, "mobId obrigatorio"),
  name: z.string().min(1).max(100),
  flavorText: z.string().min(1).max(500),
  rarity: rarityEnum,
  effects: cardEffectsArraySchema,
  requiredStars: requiredStarsSchema.optional().default(1),
  dropChance: dropChanceSchema.optional().default(5),
});

export const cardUpdateSchema = z.object({
  name: z.string().min(1).max(100),
  flavorText: z.string().min(1).max(500),
  rarity: rarityEnum,
  effects: cardEffectsArraySchema,
  requiredStars: requiredStarsSchema.optional(),
  dropChance: dropChanceSchema.optional(),
});

export type CardCreateInput = z.infer<typeof cardCreateSchema>;
export type CardUpdateInput = z.infer<typeof cardUpdateSchema>;

// ---------------------------------------------------------------------------
// Equip / Unequip
// ---------------------------------------------------------------------------

const slotIndexSchema = z
  .number()
  .int("slotIndex deve ser inteiro")
  .min(0, "slotIndex minimo e 0")
  .max(2, "slotIndex maximo e 2");

export const equipCardSchema = z.object({
  userCardId: z.string().min(1, "userCardId e obrigatorio"),
  slotIndex: slotIndexSchema,
});

export const unequipCardSchema = z.object({
  slotIndex: slotIndexSchema,
});

export type EquipCardInput = z.infer<typeof equipCardSchema>;
export type UnequipCardInput = z.infer<typeof unequipCardSchema>;
