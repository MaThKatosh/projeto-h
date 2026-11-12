"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission, verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { isDateStr } from "@/lib/dates";
import { deleteRule, saveRule, suggestForStay } from "@/lib/revenue/service";
import type { FieldErrors } from "@/lib/auth/validation";

export type RuleResult = { ok: boolean; error?: string; fieldErrors?: FieldErrors };

export async function saveRuleAction(id: string | null, input: unknown): Promise<RuleResult> {
  const { user } = await requirePermission("revenue.manage");
  const r = await getDb().$transaction((tx) => saveRule(tx, user, id, input));
  if (r.ok) revalidatePath("/revenue");
  return r;
}

export async function deleteRuleAction(id: string): Promise<RuleResult> {
  const { user } = await requirePermission("revenue.manage");
  const r = await getDb().$transaction((tx) => deleteRule(tx, user, id));
  if (r.ok) revalidatePath("/revenue");
  return r;
}

// Sugestão de diária para a reserva (tela de nova reserva).
export async function suggestForStayAction(roomTypeId: string, checkIn: string, checkOut: string) {
  const { user } = await verifySession();
  if (!can(user.role, "reservations.manage")) return null;
  if (!isDateStr(checkIn) || !isDateStr(checkOut) || !/^[0-9a-f-]{36}$/i.test(roomTypeId)) return null;
  return suggestForStay(getDb(), roomTypeId, checkIn, checkOut);
}
