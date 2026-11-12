import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { listRequests } from "@/lib/requests/service";
import { getT } from "@/lib/i18n/server";
import { RequestBoard } from "./board";

export const dynamic = "force-dynamic";

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const tr = await getT();
  const { user } = await requirePermission("requests.handle");
  const { ver } = await searchParams;
  const all = ver === "recentes";
  const list = await listRequests(getDb(), !all);
  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("Pedidos dos hóspedes")}</h1>
          <p className="text-sm text-zinc-500">{tr("Chegam pelo QR code colado em cada quarto. Problemas também viram ocorrência na Manutenção.")}</p>
        </div>
        {can(user.role, "rooms.manage") && <Link href="/quartos/qr" className="btn-secondary">{tr("🖨 QR codes dos quartos")}</Link>}
      </div>
      <div className="flex gap-1">
        <Link href="/pedidos" className={`rounded-lg px-3 py-1.5 text-sm ${!all ? "bg-blue-600 text-white" : "bg-white"}`}>{tr("Em aberto")}</Link>
        <Link href="/pedidos?ver=recentes" className={`rounded-lg px-3 py-1.5 text-sm ${all ? "bg-blue-600 text-white" : "bg-white"}`}>{tr("Últimos 2 dias")}</Link>
      </div>
      <RequestBoard list={list} />
    </div>
  );
}
