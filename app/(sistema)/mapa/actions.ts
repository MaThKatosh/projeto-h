"use server";

import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { publish } from "@/lib/realtime";
import { changeRoomStatus, getRoomHistory, type RoomHistoryEntry, type RoomView } from "@/lib/rooms/service";
import { openTicketsForRoom, type TicketCard } from "@/lib/maintenance/service";

export async function changeStatusAction(
  roomId: string,
  change: unknown
): Promise<{ ok: true; room: RoomView } | { ok: false; error: string }> {
  const { user } = await verifySession();
  if (typeof roomId !== "string") return { ok: false, error: "Quarto inválido." };

  const result = await getDb().$transaction((tx) => changeRoomStatus(tx, user, roomId, change));
  if (!result.ok) return { ok: false, error: result.error };

  await publish({ type: "room.updated", room: result.room, by: user.fullName });
  return result;
}

export type RoomDetails = {
  history: RoomHistoryEntry[];
  tickets: TicketCard[];
  cleaning: { status: string; assignedToName: string | null; priority: boolean } | null;
};

export async function roomDetailsAction(roomId: string): Promise<RoomDetails> {
  await verifySession();
  if (typeof roomId !== "string") return { history: [], tickets: [], cleaning: null };
  const db = getDb();
  const [history, tickets, cleaning] = await Promise.all([
    getRoomHistory(db, roomId),
    openTicketsForRoom(db, roomId),
    db.cleaningTask.findFirst({
      where: { roomId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      select: { status: true, priority: true, assignedTo: { select: { fullName: true } } },
    }),
  ]);
  return {
    history,
    tickets,
    cleaning: cleaning
      ? { status: cleaning.status, priority: cleaning.priority, assignedToName: cleaning.assignedTo?.fullName ?? null }
      : null,
  };
}
