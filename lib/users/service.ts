import { Prisma } from "@/app/generated/prisma/client";
import { isDemoAccount } from "@/lib/demo";
import { SYSTEM_USERNAMES } from "@/lib/system-users";
import { audit } from "@/lib/audit";
import type { Db } from "@/lib/db-types";
import { hashPassword } from "@/lib/auth/password";
import { createUserSchema, fieldErrors, updateUserSchema } from "@/lib/auth/validation";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { canManageRole, ROLE_LABEL } from "@/lib/permissions";

// ================================================================
// GESTÃO DE USUÁRIOS (hierarquia)
// ================================================================
//
// Regra: ninguém cria, edita ou promove alguém a um cargo igual ou acima
// do seu (o administrador pode tudo). Ninguém desativa a si mesmo.

export async function createUser(
  db: Db,
  actor: SessionUser,
  input: unknown
): Promise<{ ok: true; id: string } | Failure> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const { username, fullName, role, password } = parsed.data;

  if (!canManageRole(actor.role, role)) {
    return {
      ok: false,
      error: "Revise os campos destacados.",
      fieldErrors: { role: [`Seu cargo não pode criar usuários de ${ROLE_LABEL[role]}.`] },
    };
  }

  const taken = {
    ok: false as const,
    error: "Revise os campos destacados.",
    fieldErrors: { username: ["Este usuário já existe."] },
  };

  if (await db.user.findUnique({ where: { username }, select: { id: true } })) return taken;

  try {
    const user = await db.user.create({
      data: { username, fullName, role, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    await audit(db, "user.created", { userId: actor.id, metadata: { targetId: user.id, username, role } });
    return { ok: true, id: user.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return taken;
    throw error;
  }
}

export async function updateUser(
  db: Db,
  actor: SessionUser,
  targetId: string,
  input: unknown
): Promise<{ ok: true } | Failure> {
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, username: true } });
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  // Usuário técnico da integração (channel manager): ninguém entra com ele.
  if (isDemoAccount(target.username)) return { ok: false, error: "Na versão de teste as contas de teste não podem ser alteradas." };
  if (SYSTEM_USERNAMES.includes(target.username)) return { ok: false, error: "Este usuário é da integração e não pode ser alterado." };

  const self = target.id === actor.id;
  const { fullName, role, active, password } = parsed.data;

  if (self) {
    if (!active) return { ok: false, error: "Você não pode desativar o próprio usuário." };
    if (role !== target.role) return { ok: false, error: "Você não pode mudar o próprio cargo." };
  } else if (!canManageRole(actor.role, target.role) || !canManageRole(actor.role, role)) {
    return { ok: false, error: "Seu cargo não pode alterar este usuário para esse cargo." };
  }

  await db.user.update({
    where: { id: targetId },
    data: {
      fullName,
      role,
      active,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  // Desativado ou com senha nova: derruba as sessões abertas dele.
  if (!self && (!active || password)) {
    await db.authSession.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await audit(db, "user.updated", {
    userId: actor.id,
    metadata: { targetId, role, active, passwordReset: Boolean(password) },
  });

  return { ok: true };
}
