"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { searchGuests } from "@/lib/guests/service";
import { anonymizeGuest, anonymizeOld, countOldGuests } from "@/lib/privacy/service";

export async function searchGuestsAction(q: string) {
  await requirePermission("settings.manage");
  return (await searchGuests(getDb(), q, 15)).map((g) => ({ id: g.id, fullName: g.fullName, docNumber: g.docNumber, email: g.email, stays: g.stays }));
}

export async function anonymizeGuestAction(id: string) {
  const { user } = await requirePermission("settings.manage");
  const r = await getDb().$transaction((tx) => anonymizeGuest(tx, user, id));
  revalidatePath("/configuracoes/privacidade");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function countOldAction(years: number) {
  await requirePermission("settings.manage");
  return countOldGuests(getDb(), years);
}

export async function anonymizeOldAction(years: number) {
  const { user } = await requirePermission("settings.manage");
  const r = await getDb().$transaction((tx) => anonymizeOld(tx, user, years), { timeout: 120_000 });
  revalidatePath("/configuracoes/privacidade");
  return r.ok ? { ok: true, count: r.count } : { ok: false, error: r.error };
}
