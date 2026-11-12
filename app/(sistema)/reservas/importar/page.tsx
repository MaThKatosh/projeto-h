import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { getT } from "@/lib/i18n/server";
import { ImportScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  await requirePermission("reservations.manage");
  const tr = await getT();
  const types = await getDb().roomType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <Link href="/reservas" className="text-sm text-blue-700 underline">{tr("← Reservas")}</Link>
        <h1 className="text-2xl font-bold">{tr("Importar reservas dos portais")}</h1>
        <p className="text-sm text-zinc-500">
          {tr("Baixe a lista de reservas no extranet do portal (Booking.com, Expedia / Hoteis.com...) e envie aqui. Nada é gravado antes da sua conferência; importar o mesmo arquivo de novo não duplica.")}
        </p>
      </div>
      <ImportScreen types={types} />
    </div>
  );
}
