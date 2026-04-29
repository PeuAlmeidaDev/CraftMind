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

const statName = z.enum([
  "physicalAtk",
  "physicalDef",
  "magicAtk",
  "magicDef",
  "hp",
  "speed",
  "accuracy",
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
