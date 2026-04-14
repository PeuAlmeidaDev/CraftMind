import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter no minimo 2 caracteres")
    .max(50, "Nome deve ter no maximo 50 caracteres")
    .trim()
    .regex(
      /^[a-zA-Z0-9\u00C0-\u024F _-]+$/,
      "Nome contem caracteres nao permitidos"
    ),
  email: z
    .string()
    .email("Email invalido")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "Senha deve ter no minimo 8 caracteres")
    .max(72, "Senha deve ter no maximo 72 caracteres")
    .regex(/[A-Z]/, "Senha deve conter pelo menos 1 letra maiuscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos 1 numero"),
  habitIds: z
    .array(z.string().cuid())
    .min(3, "Selecione no minimo 3 habitos")
    .max(10, "Selecione no maximo 10 habitos"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email("Email invalido")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, "Senha e obrigatoria"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
