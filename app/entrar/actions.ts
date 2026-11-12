"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import { getDb } from "@/lib/db";
import { authenticate, revokeSessionToken } from "@/lib/auth/service";
import {
  clearSessionCookie,
  getRequestMeta,
  getSessionTokenFromCookie,
  setSessionCookie,
} from "@/lib/auth/dal";
import type { FieldErrors } from "@/lib/auth/validation";

export type LoginState = { error?: string; fieldErrors?: FieldErrors; username?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const result = await authenticate(
    getDb(),
    { username, password: String(formData.get("password") ?? "") },
    await getRequestMeta()
  );

  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, username };

  await setSessionCookie(result.token);
  redirect("/mapa");
}

export async function logoutAction() {
  await revokeSessionToken(getDb(), await getSessionTokenFromCookie());
  await clearSessionCookie();
  redirect("/entrar");
}

// Idioma da tela de login (antes de entrar): fica num cookie.
export async function setLoginLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 24 * 60 * 60, sameSite: "lax", httpOnly: true });
  revalidatePath("/entrar");
}
