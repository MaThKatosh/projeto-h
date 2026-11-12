import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { listRooms } from "@/lib/rooms/service";
import { can } from "@/lib/permissions";
import { getBusinessDate } from "@/lib/hotel-date";
import { roomOccupants } from "@/lib/reservations/service";
import { RoomMap } from "./room-map";

import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

export default async function MapaPage({ searchParams }: { searchParams: Promise<{ semPermissao?: string }> }) {
  const tr = await getT();
  const { user } = await verifySession();
  const db = getDb();
  const today = await getBusinessDate(db);
  const [rooms, occupants] = await Promise.all([listRooms(db), roomOccupants(db, today)]);
  const { semPermissao } = await searchParams;

  return (
    <>
      {semPermissao && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{tr("Seu cargo não tem acesso àquela tela. Você voltou para o mapa.")}</p>
      )}
      <RoomMap initialRooms={rooms} role={user.role} occupants={occupants} today={today} canSeeReservations={can(user.role, "reservations.view")} />
    </>
  );
}
