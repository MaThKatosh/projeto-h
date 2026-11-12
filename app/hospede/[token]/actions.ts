"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { publish } from "@/lib/realtime";
import { createGuestRequest } from "@/lib/requests/service";
import { REQUEST_LABEL, type RequestType } from "@/lib/requests/rules";

// Pedido do hóspede (sem login: vale o código do QR + quarto ocupado).
export async function sendGuestRequestAction(token: string, input: unknown): Promise<{ ok: boolean; error?: string; number?: number }> {
  try {
    const r = await getDb().$transaction((tx) => createGuestRequest(tx, token, input));
    if (!r.ok) return r;
    const type = (input as { type?: RequestType })?.type;
    await publish({ type: "requests.changed", message: type ? `${REQUEST_LABEL[type].icon} ${REQUEST_LABEL[type].label}` : undefined });
    if (r.ticketNumber) await publish({ type: "maintenance.changed", message: `Ocorrência ${r.ticketNumber} aberta pelo hóspede` });
    if (r.room) await publish({ type: "room.updated", room: r.room, by: "Hóspede" });
    revalidatePath(`/hospede/${token}`);
    return { ok: true, number: r.number };
  } catch (error) {
    console.error("[hospede] falha ao registrar pedido", error);
    return { ok: false, error: "Não foi possível registrar. Fale com a recepção." };
  }
}
