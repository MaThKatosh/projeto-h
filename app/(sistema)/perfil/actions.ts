"use server";

import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { changeOwnPassword } from "@/lib/auth/service";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n/locales";
import type { FieldErrors } from "@/lib/auth/validation";

export type PasswordState = { error?: string; success?: string; fieldErrors?: FieldErrors } | undefined;

export async function changePasswordAction(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const { user, sessionId } = await verifySession();
  const result = await changeOwnPassword(getDb(), user.id, sessionId, Object.fromEntries(form));
  if (!result.ok) return result;
  return { success: "Senha trocada. Outros aparelhos onde você estava conectado foram desconectados." };
}

// Idioma do próprio funcionário (null = padrão do hotel).
export async function setMyLocaleAction(locale: string | null): Promise<{ ok: boolean }> {
  const { user } = await verifySession();
  if (locale !== null && !isLocale(locale)) return { ok: false };
  await getDb().user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/", "layout");
  return { ok: true };
}
