import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { getHousekeepingBoard } from "@/lib/housekeeping/service";
import { HousekeepingBoard } from "./board";

export const dynamic = "force-dynamic";

export default async function GovernancaPage() {
  const { user } = await requirePermission("housekeeping.view");
  const board = await getHousekeepingBoard(getDb());

  return (
    <HousekeepingBoard
      board={board}
      serverNow={board.generatedAt}
      me={{ id: user.id, isHousekeeper: user.role === "GOVERNANCA" }}
      canWork={can(user.role, "rooms.housekeeping")}
      canAssign={can(user.role, "housekeeping.assign")}
    />
  );
}
