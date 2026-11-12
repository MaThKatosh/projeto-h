"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { publish } from "@/lib/realtime";
import { receivePending, writeOffPending } from "@/lib/pending/service";
import type { FieldErrors } from "@/lib/auth/validation";

export type PendingActionResult = { ok: boolean; error?: string; fieldErrors?: FieldErrors };

async function done() {
  await publish({ type: "reservations.changed" });
  revalidatePath("/financeiro", "layout");
}

export async function receivePendingAction(id: string, input: unknown): Promise<PendingActionResult> {
  const { user } = await verifySession();
  const r = await getDb().$transaction((tx) => receivePending(tx, user, id, input));
  if (r.ok) await done();
  return r.ok ? { ok: true } : r;
}

export async function writeOffPendingAction(id: string, reason: string): Promise<PendingActionResult> {
  const { user } = await verifySession();
  const r = await getDb().$transaction((tx) => writeOffPending(tx, user, id, reason));
  if (r.ok) await done();
  return r.ok ? { ok: true } : r;
}
