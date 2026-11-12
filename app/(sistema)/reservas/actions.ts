"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { publish } from "@/lib/realtime";
import { isDateStr } from "@/lib/dates";
import type { FieldErrors } from "@/lib/auth/validation";
import type { Failure, SessionUser } from "@/lib/auth/service";
import type { Db } from "@/lib/db-types";
import type { RoomView } from "@/lib/rooms/service";
import { searchGuests } from "@/lib/guests/service";
import * as svc from "@/lib/reservations/service";
import * as folio from "@/lib/folio/service";

export type ActionResult = { ok: boolean; error?: string; fieldErrors?: FieldErrors; id?: string; number?: number };

// Roda a operação numa transação, avisa as telas e traduz erros.
async function run<T extends { ok: true; rooms?: RoomView[]; id?: string; number?: number }>(
  fn: (db: Db, user: SessionUser) => Promise<T | Failure>
): Promise<ActionResult> {
  const { user } = await verifySession();
  try {
    const result = await getDb().$transaction((tx) => fn(tx, user));
    if (!result.ok) return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
    for (const room of result.rooms ?? []) await publish({ type: "room.updated", room, by: user.fullName });
    await publish({ type: "reservations.changed" });
    revalidatePath("/", "layout");
    return { ok: true, id: result.id, number: result.number };
  } catch (error) {
    const text = String((error as Error)?.message ?? error);
    if (text.includes("Reservation_no_room_overlap")) {
      return { ok: false, error: "Este quarto acabou de ser reservado por outra pessoa. Escolha outro." };
    }
    if (!(error instanceof Error) || text.length > 300) console.error(error);
    // Erros de regra lançados de propósito (ex.: walk-in) chegam com texto curto e claro.
    return { ok: false, error: text.length <= 300 ? text : "Não foi possível concluir. Tente de novo." };
  }
}

export async function createReservationAction(input: unknown) {
  return run((db, u) => svc.createReservation(db, u, input));
}

export async function walkInAction(input: unknown) {
  return run((db, u) => svc.walkIn(db, u, input));
}

export async function updateReservationAction(id: string, input: unknown) {
  return run((db, u) => svc.updateReservation(db, u, id, input));
}

export async function updateGuestAction(guestId: string, input: unknown) {
  return run((db, u) => svc.updateGuest(db, u, guestId, input));
}

// Ficha do hóspede + dados da viagem, juntos.
export async function updateGuestAndTripAction(reservationId: string, guestId: string, guest: unknown, trip: unknown) {
  return run(async (db, u) => {
    const a = await svc.updateGuest(db, u, guestId, guest);
    if (!a.ok) return a;
    return svc.updateTrip(db, u, reservationId, trip);
  });
}

export async function addCompanionAction(reservationId: string, input: unknown) {
  return run((db, u) => svc.addCompanion(db, u, reservationId, input));
}

export async function removeCompanionAction(reservationId: string, guestId: string) {
  return run((db, u) => svc.removeCompanion(db, u, reservationId, guestId));
}

export async function assignRoomAction(id: string, roomId: string | null) {
  return run((db, u) => svc.assignRoom(db, u, id, roomId));
}

export async function cancelAction(id: string, reason: string, noShow: boolean) {
  return run((db, u) => svc.cancelReservation(db, u, id, reason, noShow));
}

export async function checkInAction(id: string, input: unknown) {
  return run((db, u) => svc.checkIn(db, u, id, input));
}

export async function checkOutAction(id: string) {
  return run((db, u) => svc.checkOut(db, u, id));
}

export async function moveRoomAction(id: string, toRoomId: string, reason: string) {
  return run((db, u) => svc.moveRoom(db, u, id, toRoomId, reason));
}

export async function addVehicleAction(reservationId: string, input: unknown) {
  return run((db, u) => svc.addVehicle(db, u, reservationId, input));
}

export async function vehicleExitAction(vehicleId: string) {
  return run((db, u) => svc.vehicleExit(db, u, vehicleId));
}

// ----------------------------------------------------------------
// Consultas para os formulários
// ----------------------------------------------------------------

async function requireView() {
  const { user } = await verifySession();
  if (!can(user.role, "reservations.view")) throw new Error("Sem permissão.");
}

export async function searchGuestsAction(query: string) {
  await requireView();
  return typeof query === "string" ? searchGuests(getDb(), query) : [];
}

export async function availabilityAction(from: string, to: string, ignoreReservationId?: string) {
  await requireView();
  if (!isDateStr(from) || !isDateStr(to) || to <= from) return [];
  return svc.availability(getDb(), from, to, { ignoreReservationId });
}

export async function readyRoomsAction(from: string, to: string, reservationId?: string) {
  await requireView();
  if (!isDateStr(from) || !isDateStr(to) || to <= from) return [];
  return svc.readyRooms(getDb(), from, to, reservationId);
}

// Quartos sem reserva nessas datas (para reservar com quarto já escolhido;
// não precisa estar limpo agora).
export async function freeRoomsAction(from: string, to: string, reservationId?: string) {
  await requireView();
  if (!isDateStr(from) || !isDateStr(to) || to <= from) return [];
  const db = getDb();
  const grid = await svc.reservationGrid(db, from, 0);
  const busy = await db.reservation.findMany({
    where: {
      roomId: { not: null },
      status: { in: ["CONFIRMADA", "HOSPEDADA"] },
      checkIn: { lt: new Date(`${to}T00:00:00Z`) },
      checkOut: { gt: new Date(`${from}T00:00:00Z`) },
      ...(reservationId ? { id: { not: reservationId } } : {}),
    },
    select: { roomId: true },
  });
  const ids = new Set(busy.map((b) => b.roomId));
  return grid.rooms
    .filter((r) => !r.blocked && !ids.has(r.id))
    .sort((a, b) => a.number.localeCompare(b.number, "pt-BR", { numeric: true }));
}

// ----------------------------------------------------------------
// Conta do quarto (Fase 4)
// ----------------------------------------------------------------

export async function postNightsAction(reservationId: string, forCheckout: boolean) {
  return run((db, u) => folio.postPendingNights(db, u, reservationId, forCheckout));
}

export async function addChargeAction(reservationId: string, input: unknown) {
  return run((db, u) => folio.addCharge(db, u, reservationId, input));
}

export async function addPaymentAction(reservationId: string, input: unknown) {
  return run((db, u) => folio.addPayment(db, u, reservationId, input));
}

export async function refundAction(reservationId: string, input: unknown) {
  return run((db, u) => folio.refund(db, u, reservationId, input));
}

export async function reverseAction(entryId: string, reason: string) {
  return run((db, u) => folio.reverseEntry(db, u, entryId, reason));
}

// ----------------------------------------------------------------
// Desfazer (gerente / administrador)
// ----------------------------------------------------------------

export async function undoCheckInAction(id: string, reason: string) {
  return run((db, u) => svc.undoCheckIn(db, u, id, reason));
}

export async function undoCheckOutAction(id: string, reason: string) {
  return run((db, u) => svc.undoCheckOut(db, u, id, reason));
}

export async function reactivateAction(id: string, reason: string) {
  return run((db, u) => svc.reactivateReservation(db, u, id, reason));
}
