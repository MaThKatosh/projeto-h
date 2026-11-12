"use server";

import { redirect } from "next/navigation";
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
