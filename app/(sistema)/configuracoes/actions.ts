"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { saveCardBrand, saveHotelSettings } from "@/lib/settings";
import type { FieldErrors } from "@/lib/auth/validation";

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
