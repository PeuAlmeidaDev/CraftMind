import { z } from "zod";

export const completeTaskParamsSchema = z.object({
  id: z.string().cuid("ID da tarefa deve ser um CUID valido"),
});

export type CompleteTaskParams = z.infer<typeof completeTaskParamsSchema>;
