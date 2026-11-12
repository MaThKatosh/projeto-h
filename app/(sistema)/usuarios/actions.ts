"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { createUser, updateUser } from "@/lib/users/service";
import type { FieldErrors } from "@/lib/auth/validation";

export type FormState = { error?: string; success?: string; fieldErrors?: FieldErrors } | undefined;

export async function createUserAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePermission("users.manage");
  const result = await createUser(getDb(), user, Object.fromEntries(form));
  if (!result.ok) return result;
  revalidatePath("/usuarios");
  return { success: "Usuário criado. Passe o usuário e a senha para o funcionário." };
}

export async function updateUserAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePermission("users.manage");
  const password = String(form.get("password") ?? "");
  const result = await updateUser(getDb(), user, String(form.get("id")), {
    fullName: form.get("fullName"),
    role: form.get("role"),
    active: form.get("active") === "on",
    password: password || undefined,
  });
  if (!result.ok) return result;
  revalidatePath("/usuarios");
  return { success: password ? "Salvo. Senha trocada e sessões dele encerradas." : "Salvo." };
}
