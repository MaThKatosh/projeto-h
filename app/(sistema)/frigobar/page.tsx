import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { inHouseGuests, listMenu } from "@/lib/restaurant/service";
import { minibarToday } from "@/lib/minibar/service";
import { MinibarScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function FrigobarPage({ searchParams }: { searchParams: Promise<{ reserva?: string; quarto?: string }> }) {
  await requirePermission("minibar.post");
  const db = getDb();
  const [guests, menu, today, params] = await Promise.all([inHouseGuests(db), listMenu(db, "FRIGOBAR"), minibarToday(db), searchParams]);
  // Vindo da governança: ?quarto=101. Vindo da reserva: ?reserva=<id>.
  const initial = guests.find((g) => g.reservationId === params.reserva || (params.quarto && g.room === params.quarto))?.reservationId ?? "";
  return <MinibarScreen guests={guests} menu={menu} today={today} initialReservation={initial} />;
}
