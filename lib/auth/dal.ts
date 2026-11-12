import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { validateSessionToken, type ValidatedSession } from "@/lib/auth/service";
import { can, type Permission } from "@/lib/permissions";

// ================================================================
// PONTO ÚNICO DE VERIFICAÇÃO DA SESSÃO NO SERVIDOR
// ================================================================
//
// Toda página e Server Action protegida passa por aqui. O proxy.ts faz
// só um redirecionamento rápido de quem nem tem cookie.

export const getCurrentSession = cache(async (): Promise<ValidatedSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return validateSessionToken(getDb(), token);
});

export async function verifySession(): Promise<ValidatedSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/entrar");
  return session;
}

// Para páginas: sem permissão, volta ao mapa.
export async function requirePermission(permission: Permission): Promise<ValidatedSession> {
  const session = await verifySession();
  if (!can(session.user.role, permission)) redirect("/mapa?semPermissao=1");
  return session;
}

export async function getRequestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
}

export async function getSessionTokenFromCookie() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
