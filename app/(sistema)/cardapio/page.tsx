import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { getServiceFeeBp, listMenu } from "@/lib/restaurant/service";
import { MenuRow, ServiceFeeForm, TableRow } from "./forms";

import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

export default async function CardapioPage() {
  const tr = await getT();
  await requirePermission("menu.manage");
  const db = getDb();
  const [restaurant, minibar, tables, feeBp] = await Promise.all([
    listMenu(db, "RESTAURANTE", false),
    listMenu(db, "FRIGOBAR", false),
    db.diningTable.findMany({ select: { id: true, name: true, seats: true, active: true } }),
    getServiceFeeBp(db),
  ]);
  tables.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tr("Cardápio, frigobar e mesas")}</h1>
        <p className="text-sm text-zinc-500">{tr("Mudar um preço aqui não altera pedidos já feitos (a comanda guarda o preço do momento). Itens desativados somem do pedido, mas continuam no histórico.")}</p>
      </div>

      <section className="card space-y-2 p-5">
        <h2 className="font-semibold">{tr("🍽 Restaurante ({0})", [restaurant.length])}</h2>
        <p className="text-xs text-zinc-500">{tr("“Cozinha” marcado = o item aparece na tela da cozinha. Desmarcado = sai na hora (ex.: refrigerante).")}</p>
        {restaurant.map((m) => <MenuRow key={m.id} item={m} outlet="RESTAURANTE" />)}
        <MenuRow outlet="RESTAURANTE" />
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-semibold">{tr("🧃 Frigobar ({0})", [minibar.length])}</h2>
        {minibar.map((m) => <MenuRow key={m.id} item={m} outlet="FRIGOBAR" />)}
        <MenuRow outlet="FRIGOBAR" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-2 p-5">
          <h2 className="font-semibold">{tr("🪑 Mesas ({0})", [tables.length])}</h2>
          {tables.map((t) => <TableRow key={t.id} table={t} />)}
          <TableRow />
        </section>
        <ServiceFeeForm percent={feeBp / 100} />
      </div>
    </div>
  );
}
