import { z } from "zod";
import { ROLES } from "@/lib/permissions";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const username = z
  .string({ error: "Informe o usuário." })
  .trim()
  .toLowerCase()
  .min(3, "O usuário precisa ter pelo menos 3 caracteres.")
  .max(32, "O usuário pode ter no máximo 32 caracteres.")
  .regex(/^[a-z0-9._-]+$/, "Use só letras sem acento, números, ponto, hífen ou _.");

export const password = z
  .string({ error: "Informe a senha." })
  .min(PASSWORD_MIN, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`);

const fullName = z
  .string({ error: "Informe o nome." })
  .trim()
  .min(2, "O nome precisa ter pelo menos 2 caracteres.")
  .max(80, "O nome pode ter no máximo 80 caracteres.")
  .refine((v) => !/[\u0000-\u001f\u007f<>]/.test(v), "O nome contém caracteres não permitidos.");

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Informe o usuário.").max(32),
  password: z.string().min(1, "Informe a senha.").max(PASSWORD_MAX),
});

export const createUserSchema = z.object({
  username,
  fullName,
  role: z.enum(ROLES, { error: "Escolha o cargo." }),
  password,
});

export const updateUserSchema = z.object({
  fullName,
  role: z.enum(ROLES, { error: "Escolha o cargo." }),
  active: z.boolean(),
  // Opcional: em branco mantém a senha atual.
  password: password.optional(),
});

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual.").max(PASSWORD_MAX),
    newPassword: password,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ["newPassword"],
    message: "A nova senha precisa ser diferente da atual.",
  });

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
