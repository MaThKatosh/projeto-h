"use server";

import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import type { Db } from "@/lib/db-types";
import { guestData } from "@/lib/guests/service";
import { parseGuestsFile } from "@/lib/guests/import";

export type GuestPreview = { line: number; name: string; doc: string | null; action: "novo" | "existe" | "erro"; reason: string | null };

const MAX = 3_000_000;

// Já está cadastrado? Mesmo documento, ou mesmo nome + e-mail.
async function exists(db: Db, data: ReturnType<typeof guestData>) {
  if (data.docNumber) {
    if (await db.guest.findFirst({ where: { docNumber: data.docNumber }, select: { id: true } })) return true;
  }
  if (data.email) {
    if (await db.guest.findFirst({ where: { email: { equals: data.email, mode: "insensitive" }, fullName: { equals: data.fullName, mode: "insensitive" } }, select: { id: true } })) return true;
  }
  return false;
}

async function plan(text: string) {
  if (text.length > MAX) return { error: "Arquivo grande demais (máx. 3 MB)." };
  const file = parseGuestsFile(text);
  if (file.missing.length) return { error: `Não achei estas colunas no arquivo: ${file.missing.join(", ")}.` };
  if (file.rows.length > 20000) return { error: "No máximo 20.000 linhas por vez." };
  const db = getDb();
  const seen = new Set<string>();
  const out: (GuestPreview & { data?: ReturnType<typeof guestData> })[] = [];
  for (const r of file.rows) {
    if (!r.data) {
      out.push({ line: r.line, name: "", doc: null, action: "erro", reason: r.error ?? null });
      continue;
    }
    const data = guestData(r.data);
    const key = data.docNumber ?? `${data.fullName}|${data.email ?? ""}`.toLowerCase();
    if (seen.has(key) || (await exists(db, data))) {
      out.push({ line: r.line, name: data.fullName, doc: data.docNumber, action: "existe", reason: seen.has(key) ? "repetido no arquivo" : "já cadastrado" });
      continue;
    }
    seen.add(key);
    out.push({ line: r.line, name: data.fullName, doc: data.docNumber, action: "novo", reason: null, data });
  }
  return { rows: out };
}

export async function previewGuestsAction(text: string): Promise<{ error?: string; rows?: GuestPreview[] }> {
  await requirePermission("settings.manage");
  const p = await plan(text);
  return p.error ? { error: p.error } : { rows: p.rows!.map((r) => ({ line: r.line, name: r.name, doc: r.doc, action: r.action, reason: r.reason })) };
}

export async function importGuestsAction(text: string): Promise<{ error?: string; created?: number }> {
  const { user } = await requirePermission("settings.manage");
  const p = await plan(text);
  if (p.error) return { error: p.error };
  const toCreate = p.rows!.filter((r) => r.action === "novo" && r.data).map((r) => r.data!);
  const db = getDb();
  for (let i = 0; i < toCreate.length; i += 500) await db.guest.createMany({ data: toCreate.slice(i, i + 500) });
  await audit(db, "guests.imported", { userId: user.id, metadata: { created: toCreate.length } });
  return { created: toCreate.length };
}
