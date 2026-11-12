import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { getMaintenanceBoard } from "@/lib/maintenance/service";
import { compareRoomNumbers } from "@/lib/rooms/service";
import { MaintenanceBoard } from "./board";

export const dynamic = "force-dynamic";

export default async function ManutencaoPage({ searchParams }: { searchParams: Promise<{ id?: string; nova?: string; quarto?: string }> }) {
  const { user } = await requirePermission("maintenance.view");
  const db = getDb();
  const [board, rooms, params] = await Promise.all([
    getMaintenanceBoard(db),
    db.room.findMany({ where: { active: true }, select: { id: true, number: true } }),
    searchParams,
  ]);
  rooms.sort((a, b) => compareRoomNumbers(a.number, b.number));

  return (
    <MaintenanceBoard
      board={board}
      rooms={rooms}
      serverNow={board.generatedAt}
      me={user.id}
      perms={{
        report: can(user.role, "rooms.reportProblem"),
        work: can(user.role, "rooms.maintenance"),
        cancel: can(user.role, "maintenance.cancel"),
      }}
      initialTicketId={params.id ?? null}
      initialNew={params.nova === "1" ? { roomId: params.quarto ?? "" } : null}
    />
  );
}
