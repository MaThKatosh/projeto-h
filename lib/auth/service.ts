import { audit } from "@/lib/audit";
import { isDemoAccount } from "@/lib/demo";
import type { Db } from "@/lib/db-types";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { generateSessionToken, hashToken } from "@/lib/auth/tokens";
import { changeOwnPasswordSchema, fieldErrors, loginSchema, type FieldErrors } from "@/lib/auth/validation";
import { SESSION_COOKIE_MAX_AGE } from "@/lib/auth/cookie";
import type { Role } from "@/lib/permissions";

// ================================================================
// SERVIÇO DE AUTENTICAÇÃO
// ================================================================
//
// Não conhece Next.js nem cookies: recebe o banco e os dados já
// extraídos da requisição. Usuários são criados por um gerente ou
// administrador (não existe cadastro aberto).

const SESSION_TTL_MS = SESSION_COOKIE_MAX_AGE * 1000;
const SESSION_REFRESH_MS = 10 * 60 * 1000;

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
};

export type ValidatedSession = { sessionId: string; user: SessionUser };

export type Failure = { ok: false; error: string; fieldErrors?: FieldErrors };

const userSelect = { id: true, username: true, fullName: true, role: true } as const;

// ----------------------------------------------------------------
// Limite de tentativas de login (em memória: o sistema roda num único
// servidor no hotel). 8 erros em 15 minutos por usuário+IP.
// ----------------------------------------------------------------

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const loginFailures = new Map<string, { count: number; since: number }>();

function tooManyFailures(key: string, now: number): boolean {
  const entry = loginFailures.get(key);
  if (!entry || now - entry.since > LOGIN_WINDOW_MS) return false;
  return entry.count >= LOGIN_MAX_FAILURES;
}

function registerFailure(key: string, now: number) {
  const entry = loginFailures.get(key);
  if (!entry || now - entry.since > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, since: now });
  } else {
    entry.count += 1;
  }
}

export function resetLoginLimiter() {
  loginFailures.clear();
}

// ----------------------------------------------------------------
// SESSÕES
// ----------------------------------------------------------------

export async function createSession(
  db: Db,
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
  now = new Date()
) {
  const token = generateSessionToken();
  await db.authSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      lastSeenAt: now,
      ipAddress: meta.ipAddress?.slice(0, 64),
      userAgent: meta.userAgent?.slice(0, 256),
    },
  });
  return token;
}

export async function validateSessionToken(
  db: Db,
  token: string | undefined,
  now = new Date()
): Promise<ValidatedSession | null> {
  if (!token || token.length > 128) return null;

  const session = await db.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { ...userSelect, active: true } } },
  });

  if (!session || session.revokedAt || session.expiresAt <= now || !session.user.active) {
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > SESSION_REFRESH_MS) {
    await db.authSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
    });
  }

  const { active: _active, ...user } = session.user;
  void _active;
  return { sessionId: session.id, user };
}

export async function revokeSessionToken(db: Db, token: string | undefined) {
  if (!token) return;
  await db.authSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ----------------------------------------------------------------
// LOGIN
// ----------------------------------------------------------------

const LOGIN_FAILED = "Usuário ou senha incorretos.";

export async function authenticate(
  db: Db,
  input: unknown,
  meta: { ipAddress?: string | null; userAgent?: string | null }
): Promise<{ ok: true; user: SessionUser; token: string } | Failure> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const { username, password } = parsed.data;
  const key = `${username}|${meta.ipAddress ?? "?"}`;
  const now = Date.now();

  if (tooManyFailures(key, now)) {
    await audit(db, "auth.login.blocked", { ipAddress: meta.ipAddress, metadata: { username } });
    return { ok: false, error: "Muitas tentativas erradas. Aguarde 15 minutos ou peça ajuda ao gerente." };
  }

  const user = await db.user.findUnique({
    where: { username },
    select: { ...userSelect, passwordHash: true, active: true },
  });

  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyAgainstDummy(password);

  if (!user || !valid || !user.active) {
    registerFailure(key, now);
    await audit(db, "auth.login.failure", {
      userId: user?.id,
      ipAddress: meta.ipAddress,
      metadata: { username, inactive: Boolean(user && valid && !user.active) },
    });
    return { ok: false, error: user && valid ? "Este usuário está desativado." : LOGIN_FAILED };
  }

  loginFailures.delete(key);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = await createSession(db, user.id, meta);
  await audit(db, "auth.login.success", { userId: user.id, ipAddress: meta.ipAddress });

  return {
    ok: true,
    token,
    user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
  };
}

// ----------------------------------------------------------------
// TROCAR A PRÓPRIA SENHA
// ----------------------------------------------------------------

export async function changeOwnPassword(
  db: Db,
  userId: string,
  currentSessionId: string,
  input: unknown
): Promise<{ ok: true } | Failure> {
  const parsed = changeOwnPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true, username: true } });
  if (isDemoAccount(user.username)) return { ok: false, error: "Na versão de teste a senha das contas de teste não muda." };
  if (!(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: { currentPassword: ["Senha atual incorreta."] } };
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  // Encerra as outras sessões (outros computadores/celulares).
  await db.authSession.updateMany({
    where: { userId, revokedAt: null, id: { not: currentSessionId } },
    data: { revokedAt: new Date() },
  });
  await audit(db, "auth.password.changed", { userId });

  return { ok: true };
}
