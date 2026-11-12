import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { listPending } from "@/lib/pending/service";
import { getHotelSettings, listCardBrands } from "@/lib/settings";
import { LiveRefresher } from "@/components/live-refresher";
import { getT } from "@/lib/i18n/server";
import { PendingCard } from "./card";

export const dynamic = "force-dynamic";

export default async function PendentesPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const tr = await getT();
  const { user } = await requirePermission("finance.view");
  const { ver } = await searchParams;
  const all = ver === "todas";
  const db = getDb();
  const [list, settings, brands] = await Promise.all([listPending(db, all ? "TODAS" : "ABERTA"), getHotelSettings(db), listCardBrands(db, true)]);
  const open = list.filter((p) => p.status === "ABERTA");
  const total = open.reduce((s, p) => s + p.remainingCents, 0);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/financeiro" className="text-sm text-blue-700 underline">{tr("← Financeiro")}</Link>
          <h1 className="text-2xl font-bold">{tr("Contas pendentes")}</h1>
          <p className="text-sm text-zinc-500">{tr("Hóspedes que saíram devendo parte da conta. O recebimento entra no borderô do dia em que for pago.")}</p>
          <LiveRefresher types={["reservations.changed"]} />
        </div>
        <div className="rounded-xl bg-amber-100 px-4 py-2 text-amber-900">
          <div className="text-xs">{tr("A receber")}</div>
          <div className="text-xl font-black">{formatBRL(total)}</div>
        </div>
      </div>
      <div className="flex gap-1">
        <Link href="/financeiro/pendentes" className={`rounded-lg px-3 py-1.5 text-sm ${!all ? "bg-blue-600 text-white" : "bg-white"}`}>{tr("Em aberto ({0})", [open.length])}</Link>
        <Link href="/financeiro/pendentes?ver=todas" className={`rounded-lg px-3 py-1.5 text-sm ${all ? "bg-blue-600 text-white" : "bg-white"}`}>{tr("Todas")}</Link>
      </div>
      {list.length === 0 && <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400">{tr("Nenhuma conta pendente.")}</p>}
      <div className="space-y-3">
        {list.map((p) => (
          <PendingCard
            key={p.id}
            p={p}
            created={formatDate(p.businessDate, true)}
            canReceive={can(user.role, "finance.post")}
            canWriteOff={can(user.role, "finance.reverse")}
            paymentOptions={{ methods: settings.enabledMethods, brands: brands.map((b) => b.name) }}
          />
        ))}
      </div>
    </div>
  );
}
