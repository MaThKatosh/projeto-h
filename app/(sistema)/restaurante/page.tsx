import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { inHouseGuests, restaurantBoard } from "@/lib/restaurant/service";
import { FloorBoard } from "./floor";

export const dynamic = "force-dynamic";

export default async function RestaurantePage() {
  const { user } = await requirePermission("restaurant.use");
  const db = getDb();
  const [board, guests] = await Promise.all([restaurantBoard(db), inHouseGuests(db)]);
  return (
    <FloorBoard
      tables={board.tables}
      open={board.open}
      guests={guests}
      serverNow={board.generatedAt}
      canKitchen={can(user.role, "kitchen.view")}
      canMenu={can(user.role, "menu.manage")}
    />
  );
}
