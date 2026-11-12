import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { getBusinessDate } from "@/lib/hotel-date";
import { listRatePlans } from "@/lib/rates/service";
import { getReservation } from "@/lib/reservations/service";
import { getFolio } from "@/lib/folio/service";
import { getHotelSettings, listCardBrands } from "@/lib/settings";
import { openPendingForGuest, pendingEntryIds } from "@/lib/pending/service";
import { ReservationView } from "./view";

export const dynamic = "force-dynamic";

export default async function ReservaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ acao?: string }> }) {
  const { user } = await requirePermission("reservations.view");
  const { id } = await params;
  const { acao } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = getDb();
  const [reservation, folio, today, plans, types, settings, brands] = await Promise.all([
    getReservation(db, id),
    getFolio(db, id),
    getBusinessDate(db),
    listRatePlans(db, { activeOnly: true }),
    db.roomType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true } }),
    getHotelSettings(db),
    listCardBrands(db, true),
  ]);
  if (!reservation || !folio) notFound();
  const [pendingAccounts, inPending] = await Promise.all([openPendingForGuest(db, reservation.guest.id), pendingEntryIds(db, id)]);

  return (
    <ReservationView
      r={reservation}
      today={today}
      plans={plans}
      types={types}
      canManage={can(user.role, "reservations.manage")}
      canUndo={can(user.role, "undo")}
      folio={folio}
      canPost={can(user.role, "finance.post")}
      canReverse={can(user.role, "finance.reverse")}
      paymentOptions={{ methods: settings.enabledMethods, brands: brands.map((b) => b.name) }}
      initialAction={acao === "checkin" || acao === "checkout" ? acao : null}
      pendingAccounts={pendingAccounts}
      inPending={inPending}
    />
  );
}
