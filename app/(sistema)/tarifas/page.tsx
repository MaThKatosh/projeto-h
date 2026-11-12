import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { listRatePlans } from "@/lib/rates/service";
import { RatePlanForm } from "./rate-form";
import { ParkingForm } from "./parking-form";
import { getParkingDailyCents } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function TarifasPage() {
  await requirePermission("rates.manage");
  const db = getDb();
  const [plans, types, parking] = await Promise.all([
    listRatePlans(db),
    db.roomType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true } }),
    getParkingDailyCents(db),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tarifas</h1>
        <p className="text-sm text-zinc-500">
          Cada tarifa tem o valor da diária por tipo de quarto. Na reserva o valor é copiado e pode ser ajustado; mudar a
          tarifa aqui não altera reservas já feitas.
        </p>
      </div>
      {plans.map((p) => (
        <RatePlanForm key={p.id} plan={p} types={types} />
      ))}
      <RatePlanForm types={types} />
      <ParkingForm cents={parking} />
    </div>
  );
}
