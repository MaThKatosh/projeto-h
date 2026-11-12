import type { Prisma } from "@/app/generated/prisma/client";
import type { Db } from "@/lib/db-types";

// Registro de ações sensíveis. Nunca guarda senhas ou tokens.
export async function audit(
  db: Db,
  action: string,
  options: { userId?: string | null; ipAddress?: string | null; metadata?: Prisma.InputJsonValue } = {}
) {
  await db.auditLog.create({
    data: {
      action,
      userId: options.userId ?? null,
      ipAddress: options.ipAddress?.slice(0, 64) ?? null,
      metadata: options.metadata,
    },
  });
}
