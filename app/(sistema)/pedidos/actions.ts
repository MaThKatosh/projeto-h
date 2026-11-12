"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { publish } from "@/lib/realtime";
import { handleRequest } from "@/lib/requests/service";

export async function handleRequestAction(id: string, action: "atender" | "concluir"): Promise<{ ok: boolean; error?: string }> {
  const { user } = await verifySession();
  if (action !== "atender" && action !== "concluir") return { ok: false, error: "Ação inválida." };
  const r = await getDb().$transaction((tx) => handleRequest(tx, user, id, action));
  if (r.ok) {
    await publish({ type: "requests.changed" });
    revalidatePath("/", "layout");
  }
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
