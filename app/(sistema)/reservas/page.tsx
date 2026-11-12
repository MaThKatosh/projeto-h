import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { getBusinessDate } from "@/lib/hotel-date";
import { addDays, formatDate, isDateStr, nightsBetween } from "@/lib/dates";
import { listReservations, reservationGrid, type ListFilter } from "@/lib/reservations/service";
import { SOURCE_LABEL, STATUS } from "@/lib/reservations/rules";
import { LiveRefresher } from "@/components/live-refresher";
import { ReservationGrid } from "./grid";

import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

const FILTERS: [ListFilter, string][] = [
  ["chegadas", "Chegadas (hoje e atrasadas)"],
  ["emCasa", "Hospedados"],
  ["saidas", "Saídas de hoje"],
  ["futuras", "Futuras"],
  ["todas", "Todas"],
];

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string; ver?: string; de?: string }>;
}) {
  const tr = await getT();
  const { user } = await requirePermission("reservations.view");
  const params = await searchParams;
  const db = getDb();
  const today = await getBusinessDate(db);
  const view = params.ver === "lista" ? "lista" : "grade";
  const filter = (FILTERS.find(([f]) => f === params.f)?.[0] ?? "chegadas") as ListFilter;
  const q = (params.q ?? "").slice(0, 60);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("Reservas")}</h1>
          <div className="flex items-center gap-3">
            <LiveRefresher types={["reservations.changed", "rooms.changed"]} />
            <span className="text-sm text-zinc-500">{tr("Data do sistema:")}{" "}<b>{formatDate(today, true)}</b></span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg bg-white p-1 shadow-sm">
            <Link href="/reservas?ver=grade" className={`rounded-md px-3 py-1.5 text-sm ${view === "grade" ? "bg-blue-600 text-white" : ""}`}>{tr("▦ Mapa de reservas")}</Link>
            <Link href="/reservas?ver=lista" className={`rounded-md px-3 py-1.5 text-sm ${view === "lista" ? "bg-blue-600 text-white" : ""}`}>{tr("☰ Lista")}</Link>
          </div>
          {can(user.role, "reservations.manage") && (
            <>
              <Link href="/reservas/nova?direto=1" className="btn-secondary">{tr("🛎 Entrada direta")}</Link>
              <Link href="/reservas/nova" className="btn-primary">{tr("+ Nova reserva")}</Link>
            </>
          )}
        </div>
      </div>

      {view === "grade" ? (
        <GridSection from={isDateStr(params.de) ? params.de : addDays(today, -1)} today={today} />
      ) : (
        <ListSection filter={filter} q={q} today={today} />
      )}
    </div>
  );
}

async function GridSection({ from, today }: { from: string; today: string }) {
  const tr = await getT();
  const days = 14;
  const grid = await reservationGrid(getDb(), from, days);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link className="btn-secondary px-3 py-1.5" href={`/reservas?ver=grade&de=${addDays(from, -7)}`}>{tr("← 7 dias")}</Link>
        <Link className="btn-secondary px-3 py-1.5" href={`/reservas?ver=grade&de=${addDays(today, -1)}`}>{tr("Hoje")}</Link>
        <Link className="btn-secondary px-3 py-1.5" href={`/reservas?ver=grade&de=${addDays(from, 7)}`}>{tr("7 dias →")}</Link>
        <span className="ml-2 flex flex-wrap gap-3 text-xs text-zinc-600">
          {(["CONFIRMADA", "HOSPEDADA", "FINALIZADA"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`inline-block h-3 w-5 rounded ${STATUS[s].bar}`} /> {tr(STATUS[s].label)}
            </span>
          ))}
        </span>
      </div>
      <ReservationGrid grid={grid} today={today} />
    </>
  );
}

async function ListSection({ filter, q, today }: { filter: ListFilter; q: string; today: string }) {
  const tr = await getT();
  const rows = await listReservations(getDb(), filter, q, today);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([f, label]) => (
            <Link
              key={f}
              href={`/reservas?ver=lista&f=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${filter === f ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"}`}
            >
              {tr(label)}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action="/reservas">
          <input type="hidden" name="ver" value="lista" />
          <input type="hidden" name="f" value={filter} />
          <input name="q" defaultValue={q} className="field w-56" placeholder={tr("Nome, nº, quarto ou código do portal")} />
          <button className="btn-secondary" type="submit">{tr("Buscar")}</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2">{tr("Nº")}</th>
              <th className="px-3 py-2">{tr("Hóspede")}</th>
              <th className="px-3 py-2">{tr("Entrada → Saída")}</th>
              <th className="px-3 py-2">{tr("Quarto")}</th>
              <th className="px-3 py-2">{tr("Pessoas")}</th>
              <th className="px-3 py-2">{tr("Origem")}</th>
              <th className="px-3 py-2">{tr("Situação")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 hover:bg-blue-50/50">
                <td className="px-3 py-2">
                  <Link href={`/reservas/${r.id}`} className="font-semibold text-blue-700 underline">{r.number}</Link>
                </td>
                <td className="px-3 py-2 font-medium">{r.guestName}</td>
                <td className="px-3 py-2">
                  {formatDate(r.checkIn)} → {formatDate(r.checkOut)}{" "}
                  <span className="text-xs text-zinc-500">{tr("({0} noites)", [nightsBetween(r.checkIn, r.checkOut)])}</span>
                  {r.status === "CONFIRMADA" && r.checkIn < today && <span className="ml-1 text-xs font-bold text-red-600">{tr("atrasada")}</span>}
                </td>
                <td className="px-3 py-2">
                  {r.roomNumber ? <b>{r.roomNumber}</b> : <span className="text-zinc-400">—</span>}{" "}
                  <span className="text-xs text-zinc-500">{r.roomTypeName}</span>
                </td>
                <td className="px-3 py-2">{r.adults}{r.children ? ` + ${r.children}` : ""}</td>
                <td className="px-3 py-2 text-xs">{tr(SOURCE_LABEL[r.source])}{r.externalCode ? ` · ${r.externalCode}` : ""}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS[r.status].chip}`}>{tr(STATUS[r.status].label)}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">{tr("Nenhuma reserva aqui.")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
