"use server";

import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { publish } from "@/lib/realtime";
import { cleaningAction } from "@/lib/housekeeping/service";

export async function cleaningActionAction(taskId: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const { user } = await verifySession();
  if (typeof taskId !== "string") return { ok: false, error: "Tarefa inválida." };

  const result = await getDb().$transaction((tx) => cleaningAction(tx, user, taskId, input));
  if (!result.ok) return { ok: false, error: result.error };

  if (result.room) await publish({ type: "room.updated", room: result.room, by: user.fullName });
  else await publish({ type: "housekeeping.changed" });
  return { ok: true };
}
