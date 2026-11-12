import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { getBusinessDate } from "@/lib/hotel-date";
import { addDays } from "@/lib/dates";
import { listRatePlans } from "@/lib/rates/service";
import { StayForm } from "../stay-form";

export const dynamic = "force-dynamic";

export default async function NovaReservaPage({ searchParams }: { searchParams: Promise<{ direto?: string }> }) {
  await requirePermission("reservations.manage");
  const db = getDb();
  const [today, plans, types, params] = await Promise.all([
    getBusinessDate(db),
    listRatePlans(db, { activeOnly: true }),
    db.roomType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true } }),
    searchParams,
  ]);
  const walkIn = params.direto === "1";

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{walkIn ? "Entrada direta (sem reserva)" : "Nova reserva"}</h1>
        <p className="text-sm text-zinc-500">
          {walkIn
            ? "O hóspede chegou sem reserva: cria a reserva e já faz o check-in num quarto limpo."
            : "Preencha o hóspede e a estadia. O quarto pode ser escolhido agora ou depois."}
        </p>
      </div>
      <StayForm
        mode={walkIn ? "direto" : "nova"}
        today={today}
        plans={plans}
        types={types}
        initial={{ checkIn: today, checkOut: addDays(today, 1) }}
      />
    </div>
  );
}
