"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { publish } from "@/lib/realtime";
import { audit } from "@/lib/audit";
import { SOURCES } from "@/lib/reservations/rules";
import { parseReservationsFile } from "@/lib/integrations/parse";
import { applyExternal, planImport, rememberTypeMap, savedTypeMap, type ImportAction, type PlanRow } from "@/lib/integrations/service";

const MAX_TEXT = 3_000_000;
const MAX_ROWS = 2000;

const inputSchema = z.object({
  text: z.string().max(MAX_TEXT, "Arquivo grande demais (máx. 3 MB)."),
  source: z.enum(SOURCES),
  typeMap: z.record(z.string(), z.string()),
});

export type PreviewResult = { ok: boolean; error?: string; rows?: PlanRow[]; labels?: string[]; typeMap?: Record<string, string> };

async function allowed() {
  const { user } = await verifySession();
  return can(user.role, "reservations.manage") ? user : null;
}

// Prévia: lê o arquivo e diz o que vai acontecer com cada linha.
export async function previewImportAction(input: unknown): Promise<PreviewResult> {
  if (!(await allowed())) return { ok: false, error: "Seu cargo não pode mexer em reservas." };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { text, source, typeMap } = parsed.data;
  const file = parseReservationsFile(text);
  if (file.missingColumns.length) return { ok: false, error: `Não achei estas colunas no arquivo: ${file.missingColumns.join(", ")}.` };
  if (file.rows.length > MAX_ROWS) return { ok: false, error: `No máximo ${MAX_ROWS} linhas por vez.` };
  const db = getDb();
  // Escolhas anteriores deste portal valem como ponto de partida.
  const map = { ...(await savedTypeMap(db, source)), ...typeMap };
  const rows = await planImport(db, source, file.rows, map);
  const labels = [...new Set(file.rows.map((r) => r.data?.roomTypeLabel).filter((l): l is string => l !== undefined))];
  return { ok: true, rows, labels, typeMap: map };
}

const applySchema = inputSchema.extend({
  breakfast: z.boolean(),
  chargeIss: z.boolean(),
  issPercent: z.coerce.number().min(0).max(20),
});

export type ApplyResult = {
  ok: boolean;
  error?: string;
  results?: { line: number; externalCode: string; guestName: string; action: ImportAction; reason: string | null; reservationId?: string; number?: number }[];
};

// Grava: cada reserva na sua transação (uma com problema não trava as outras).
export async function applyImportAction(input: unknown): Promise<ApplyResult> {
  const user = await allowed();
  if (!user) return { ok: false, error: "Seu cargo não pode mexer em reservas." };
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { text, source, typeMap, breakfast, chargeIss, issPercent } = parsed.data;
  const file = parseReservationsFile(text);
  if (file.missingColumns.length || file.rows.length > MAX_ROWS) return { ok: false, error: "Arquivo inválido." };

  const db = getDb();
  const types = await db.roomType.findMany({ select: { id: true, name: true } });
  const map = { ...(await savedTypeMap(db, source)), ...typeMap };
  await rememberTypeMap(db, source, typeMap);
  const plan = await planImport(db, source, file.rows, map);
  const results: NonNullable<ApplyResult["results"]> = [];
  for (const [i, p] of file.rows.entries()) {
    const step = plan[i];
    const base = { line: p.line, externalCode: step.externalCode, guestName: step.guestName };
    if (!p.data || step.action === "ignorar" || step.action === "erro") {
      results.push({ ...base, action: step.action, reason: step.reason });
      continue;
    }
    const data = p.data;
    const roomTypeId = step.roomTypeId && types.some((t) => t.id === step.roomTypeId) ? step.roomTypeId : null;
    try {
      const r = await db.$transaction((tx) => applyExternal(tx, user, source, data, roomTypeId, { breakfast, chargeIss, issPercent }));
      results.push({ ...base, ...r });
    } catch (error) {
      console.error("[importar] linha", p.line, error);
      results.push({ ...base, action: "erro", reason: "falha ao gravar; tente de novo" });
    }
  }
  const done = results.filter((r) => ["criar", "alterar", "cancelar"].includes(r.action)).length;
  await audit(db, "reservations.imported", { userId: user.id, metadata: { source, lines: file.rows.length, done } });
  if (done) {
    await publish({ type: "reservations.changed" });
    revalidatePath("/", "layout");
  }
  return { ok: true, results };
}
