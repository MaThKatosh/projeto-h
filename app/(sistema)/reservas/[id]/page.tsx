import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { getBusinessDate } from "@/lib/hotel-date";
import { listRatePlans } from "@/lib/rates/service";
import { getReservation } from "@/lib/reservations/service";
import { ReservationView } from "./view";

export const dynamic = "force-dynamic";

export default async function ReservaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ acao?: string }> }) {
  const { user } = await requirePermission("reservations.view");
  const { id } = await params;
  const { acao } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = getDb();
  const [reservation, today, plans, types] = await Promise.all([
    getReservation(db, id),
    getBusinessDate(db),
    listRatePlans(db, { activeOnly: true }),
    db.roomType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true } }),
  ]);
  if (!reservation) notFound();

  return (
    <ReservationView
      r={reservation}
      today={today}
      plans={plans}
      types={types}
      canManage={can(user.role, "reservations.manage")}
      initialAction={acao === "checkin" || acao === "checkout" ? acao : null}
    />
  );
}
