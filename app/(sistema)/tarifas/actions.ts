"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { saveRatePlan } from "@/lib/rates/service";
import { parseBRL } from "@/lib/money";
import { setParkingDailyCents, setParkingSpots } from "@/lib/settings";
import { audit } from "@/lib/audit";

export async function saveRatePlanAction(id: string | null, input: unknown) {
  const { user } = await requirePermission("rates.manage");
  const result = await getDb().$transaction((tx) => saveRatePlan(tx, user, id, input));
  if (result.ok) revalidatePath("/tarifas");
  return result;
}

export async function saveParkingAction(value: string, spotsText = "0"): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requirePermission("rates.manage");
  const cents = value.trim() === "" ? 0 : parseBRL(value);
  if (cents === null || cents < 0 || cents > 10_000_000) return { ok: false, error: "Valor inválido. Ex.: 30,00 (ou 0 para grátis)" };
  const spots = spotsText.trim() === "" ? 0 : Number(spotsText);
  if (!Number.isInteger(spots) || spots < 0 || spots > 5000) return { ok: false, error: "Número de vagas inválido (use 0 para sem limite)." };
  const db = getDb();
  await setParkingDailyCents(db, cents);
  await setParkingSpots(db, spots);
  await audit(db, "settings.parking", { userId: user.id, metadata: { cents, spots } });
  revalidatePath("/garagem");
  revalidatePath("/tarifas");
  return { ok: true };
}
