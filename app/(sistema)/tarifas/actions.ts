"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { saveRatePlan } from "@/lib/rates/service";

export async function saveRatePlanAction(id: string | null, input: unknown) {
  const { user } = await requirePermission("rates.manage");
  const result = await getDb().$transaction((tx) => saveRatePlan(tx, user, id, input));
  if (result.ok) revalidatePath("/tarifas");
  return result;
}
