"use server";

import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { changeOwnPassword } from "@/lib/auth/service";
import type { FieldErrors } from "@/lib/auth/validation";

export type PasswordState = { error?: string; success?: string; fieldErrors?: FieldErrors } | undefined;

export async function changePasswordAction(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const { user, sessionId } = await verifySession();
  const result = await changeOwnPassword(getDb(), user.id, sessionId, Object.fromEntries(form));
  if (!result.ok) return result;
  return { success: "Senha trocada. Outros aparelhos onde você estava conectado foram desconectados." };
}
