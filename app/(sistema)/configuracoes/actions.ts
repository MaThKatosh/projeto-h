"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { saveCardBrand, saveHotelSettings } from "@/lib/settings";
import type { FieldErrors } from "@/lib/auth/validation";
import { revokeToken, rotateToken } from "@/lib/integrations/service";

export type SaveResult = { ok: boolean; error?: string; fieldErrors?: FieldErrors };

export async function saveHotelAction(input: unknown): Promise<SaveResult> {
  const { user } = await requirePermission("settings.manage");
  const r = await getDb().$transaction((tx) => saveHotelSettings(tx, user, input));
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function saveBrandAction(id: string | null, input: unknown): Promise<SaveResult> {
  const { user } = await requirePermission("settings.manage");
  const r = await getDb().$transaction((tx) => saveCardBrand(tx, user, id, input));
  if (r.ok) revalidatePath("/configuracoes");
  return r;
}

// Chave do channel manager: mostrada uma única vez.
export async function rotateTokenAction(): Promise<string> {
  const { user } = await requirePermission("settings.manage");
  const token = await getDb().$transaction((tx) => rotateToken(tx, user));
  revalidatePath("/configuracoes");
  return token;
}

export async function revokeTokenAction() {
  const { user } = await requirePermission("settings.manage");
  await getDb().$transaction((tx) => revokeToken(tx, user));
  revalidatePath("/configuracoes");
}
