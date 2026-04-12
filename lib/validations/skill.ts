import { z } from "zod";

export const equipSkillSchema = z.object({
  skillId: z.string().min(1, "skillId e obrigatorio"),
  slotIndex: z
    .number()
    .int("slotIndex deve ser um numero inteiro")
    .min(0, "slotIndex minimo e 0")
    .max(3, "slotIndex maximo e 3"),
});

export const unequipSkillSchema = z.object({
  slotIndex: z
    .number()
    .int("slotIndex deve ser um numero inteiro")
    .min(0, "slotIndex minimo e 0")
    .max(3, "slotIndex maximo e 3"),
});

export type EquipSkillInput = z.infer<typeof equipSkillSchema>;
export type UnequipSkillInput = z.infer<typeof unequipSkillSchema>;
