"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { publish } from "@/lib/realtime";
import type { FieldErrors } from "@/lib/auth/validation";
import type { Failure, SessionUser } from "@/lib/auth/service";
import type { Db } from "@/lib/db-types";
import * as svc from "@/lib/restaurant/service";
import { postMinibar } from "@/lib/minibar/service";

export type ActionResult = { ok: boolean; error?: string; fieldErrors?: FieldErrors; id?: string; total?: number };

// Roda na transação e avisa as telas (restaurante, cozinha e, quando
// lança no quarto, a recepção/financeiro).
async function run<T extends { ok: true; id?: string; total?: number }>(
  fn: (db: Db, user: SessionUser) => Promise<T | Failure>,
  touchesFolio = false
): Promise<ActionResult> {
  const { user } = await verifySession();
  try {
    const r = await getDb().$transaction((tx) => fn(tx, user));
    if (!r.ok) return { ok: false, error: r.error, fieldErrors: r.fieldErrors };
    await publish({ type: "restaurant.changed" });
    if (touchesFolio) await publish({ type: "reservations.changed" });
    revalidatePath("/", "layout");
    return { ok: true, id: r.id, total: r.total };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Não foi possível concluir. Tente de novo." };
  }
}

export async function openComandaAction(input: unknown) {
  return run((db, u) => svc.openComanda(db, u, input));
}
export async function updateComandaAction(id: string, input: { serviceFee?: boolean; reservationId?: string | null; people?: number }) {
  return run((db, u) => svc.updateComanda(db, u, id, input));
}
export async function addItemsAction(comandaId: string, items: unknown) {
  return run((db, u) => svc.addItems(db, u, comandaId, items));
}
export async function itemStatusAction(itemId: string, status: "PRONTO" | "ENTREGUE") {
  return run((db, u) => svc.setItemStatus(db, u, itemId, status));
}
export async function cancelItemAction(itemId: string, reason: string) {
  return run((db, u) => svc.cancelItem(db, u, itemId, reason));
}
export async function posPaymentAction(comandaId: string, input: unknown) {
  return run((db, u) => svc.addPosPayment(db, u, comandaId, input), true);
}
export async function closePaidAction(comandaId: string) {
  return run((db, u) => svc.closePaid(db, u, comandaId));
}
export async function closeToRoomAction(comandaId: string, reservationId: string) {
  return run((db, u) => svc.closeToRoom(db, u, comandaId, reservationId), true);
}
export async function cancelComandaAction(comandaId: string, reason: string) {
  return run((db, u) => svc.cancelComanda(db, u, comandaId, reason));
}
export async function saveMenuItemAction(id: string | null, input: unknown) {
  return run((db, u) => svc.saveMenuItem(db, u, id, input));
}
export async function saveTableAction(id: string | null, input: unknown) {
  return run((db, u) => svc.saveTable(db, u, id, input));
}
export async function saveServiceFeeAction(percent: string) {
  return run((db, u) => svc.setServiceFeeBp(db, u, percent));
}
export async function minibarAction(reservationId: string, items: unknown) {
  return run((db, u) => postMinibar(db, u, reservationId, items), true);
}
