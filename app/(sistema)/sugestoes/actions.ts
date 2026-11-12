"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requirePermission, verifySession } from "@/lib/auth/dal";

const schema = z.object({
  kind: z.enum(["ERRO", "SUGESTAO", "ELOGIO"]),
  message: z.string().trim().min(3).max(2000),
  page: z.string().max(200).optional(),
  device: z.string().max(200).optional(),
});

// Testador manda sugestão/erro (qualquer cargo logado).
export async function sendFeedbackAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const { user } = await verifySession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escreva pelo menos algumas palavras." };
  const db = getDb();
  // limite simples: 20 mensagens por hora por pessoa
  const recent = await db.feedback.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= 20) return { ok: false, error: "Muitas mensagens em pouco tempo. Tente mais tarde." };
  await db.feedback.create({ data: { ...parsed.data, userId: user.id } });
  revalidatePath("/sugestoes");
  return { ok: true };
}

export async function toggleFeedbackAction(id: string, done: boolean) {
  await requirePermission("settings.manage");
  await getDb().feedback.update({ where: { id }, data: { done } });
  revalidatePath("/sugestoes");
}
