import { z } from "zod";

export const pveMultiActionSchema = z.object({
  battleId: z.string().min(1),
  skillId: z.string().min(1).nullable(),
  targetIndex: z.number().int().min(0).max(4).optional(),
});

export type PveMultiActionInput = z.infer<typeof pveMultiActionSchema>;

export const pveMultiForfeitSchema = z.object({
  battleId: z.string().min(1),
});
export type PveMultiForfeitInput = z.infer<typeof pveMultiForfeitSchema>;
