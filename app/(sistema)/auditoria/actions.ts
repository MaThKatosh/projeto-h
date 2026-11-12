"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { publish } from "@/lib/realtime";
import { runAudit } from "@/lib/night-audit/service";

export async function runAuditAction(): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { user } = await verifySession();
  try {
    // A auditoria inteira é uma transação: lança tudo ou nada.
    const r = await getDb().$transaction((tx) => runAudit(tx, user), { timeout: 120_000, maxWait: 10_000 });
    if (!r.ok) return { ok: false, error: r.error };
    await publish({ type: "reservations.changed" });
    revalidatePath("/", "layout");
    return { ok: true, message: `${r.nights} diária(s) lançada(s). A data do sistema agora é ${r.next.split("-").reverse().join("/")}.` };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "A auditoria não foi concluída e nada foi alterado. Tente de novo." };
  }
}
