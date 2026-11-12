import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { getBusinessDate } from "@/lib/hotel-date";
import { formatDate, localToday } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { frontDesk } from "@/lib/reservations/service";
import { displayStatus, DISPLAY } from "@/lib/rooms/status";
import { LiveRefresher } from "@/components/live-refresher";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// Recepção: uma tela só, com abas de entradas e saídas pendentes.
export default async function RecepcaoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const tr = await getT();
  const { user } = await requirePermission("reservations.view");
  const db = getDb();
  const today = await getBusinessDate(db);
  const [desk, rooms, params] = await Promise.all([
    frontDesk(db, today),
    db.room.findMany({ where: { active: true }, select: { id: true, occupancy: true, housekeeping: true, maintenance: true } }),
    searchParams,
  ]);
  const tab = params.aba === "saidas" || (params.aba !== "entradas" && desk.arrivals.length === 0 && desk.departures.length > 0) ? "saidas" : "entradas";
  const roomState = new Map(rooms.map((r) => [r.id, r]));
  const ready = rooms.filter((r) => displayStatus(r) === "LIVRE").length;
  const canManage = can(user.role, "reservations.manage");
  const behind = today < localToday();

  // Saldo das contas de quem sai (o que falta receber).
  const sums = desk.departures.length
    ? await db.folioEntry.groupBy({
        by: ["reservationId", "kind"],
        where: { reservationId: { in: desk.departures.map((r) => r.id) } },
        _sum: { amountCents: true },
      })
    : [];
  const balance = (id: string) =>
    sums.filter((s) => s.reservationId === id).reduce((t, s) => t + (s.kind === "COBRANCA" ? 1 : -1) * (s._sum.amountCents ?? 0), 0);

  const tabClass = (on: boolean) =>
    `flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold ${on ? "border-blue-600 text-blue-700" : "border-transparent text-zinc-500 hover:text-zinc-800"}`;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("Recepção")}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            <LiveRefresher types={["reservations.changed", "room.updated", "rooms.changed"]} />
            <span>{tr("Data do sistema:")}{" "}<b>{formatDate(today, true)}</b></span>
            <span>· {tr("{0} na casa", [desk.inHouse.rooms])}</span>
            <span>· {tr("{0} quartos prontos", [ready])}</span>
            {can(user.role, "audit.run") && behind && (
              <Link href="/auditoria" className="btn-secondary px-2 py-1 text-xs">{tr("🌙 Ir para a auditoria")}</Link>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Link href="/reservas/nova?direto=1" className="btn-secondary">{tr("🛎 Entrada direta")}</Link>
            <Link href="/reservas/nova" className="btn-primary">{tr("+ Nova reserva")}</Link>
          </div>
        )}
      </div>

      {behind && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{tr("O calendário já está em {0}, mas a data do sistema ainda é {1}. A data só vira quando a auditoria noturna for rodada.", [formatDate(localToday(), true), formatDate(today, true)])}</p>
      )}

      <div className="flex gap-1 border-b border-zinc-200">
        <Link href="/recepcao?aba=entradas" className={tabClass(tab === "entradas")}>
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />{tr("Entradas pendentes")}
          <span className="rounded-full bg-sky-100 px-2 text-xs text-sky-800">{desk.arrivals.length}</span>
        </Link>
        <Link href="/recepcao?aba=saidas" className={tabClass(tab === "saidas")}>
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />{tr("Saídas pendentes")}
          <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">{desk.departures.length}</span>
        </Link>
      </div>

      <div className="card divide-y divide-zinc-100">
        {tab === "entradas" &&
          desk.arrivals.map((r) => {
            const room = r.roomId ? roomState.get(r.roomId) : undefined;
            const status = room ? displayStatus(room) : null;
            const late = r.checkIn < today;
            return (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                <div className="w-14 text-center">
                  <div className="text-lg leading-none font-black">{r.roomNumber ?? "—"}</div>
                  {status ? (
                    <span className={`mt-0.5 inline-block rounded px-1 text-[10px] font-bold ${DISPLAY[status].card}`}>
                      {status === "LIVRE" ? tr("pronto") : tr(DISPLAY[status].label.toLowerCase())}
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-700">{tr("sem quarto")}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/reservas/${r.id}`} className="block truncate font-semibold hover:underline">{r.guestName}</Link>
                  <div className="text-xs text-zinc-500">
                    {tr("{0} pessoa(s)", [r.adults + r.children])} · {tr("até {0}", [formatDate(r.checkOut)])}
                    {late && <b className="text-red-600"> · {tr("atrasado")}</b>}
                  </div>
                </div>
                {canManage && (
                  <Link href={`/reservas/${r.id}?acao=checkin`} className="btn bg-emerald-600 text-white hover:bg-emerald-700">{tr("Check-in")}</Link>
                )}
              </div>
            );
          })}
        {tab === "entradas" && desk.arrivals.length === 0 && <Empty text={tr("Nenhuma chegada pendente.")} />}

        {tab === "saidas" &&
          desk.departures.map((r) => {
            const owed = balance(r.id);
            const late = r.checkOut < today;
            return (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                <div className="w-14 text-center text-lg font-black">{r.roomNumber}</div>
                <div className="min-w-0 flex-1">
                  <Link href={`/reservas/${r.id}`} className="block truncate font-semibold hover:underline">{r.guestName}</Link>
                  <div className="text-xs text-zinc-500">
                    {r.vehicles ? `🚗 ${r.vehicles} · ` : ""}
                    {owed > 0 ? <span className="font-semibold text-amber-700">{tr("a pagar {0}", [formatBRL(owed)])}</span> : owed < 0 ? <span className="text-sky-700">{tr("crédito {0}", [formatBRL(-owed)])}</span> : <span className="text-emerald-700">{tr("conta em dia")}</span>}
                    {late && <b className="text-red-600"> · {tr("atrasado")}</b>}
                  </div>
                </div>
                {canManage && (
                  <Link href={`/reservas/${r.id}?acao=checkout`} className="btn bg-blue-600 text-white hover:bg-blue-700">{tr("Check-out")}</Link>
                )}
              </div>
            );
          })}
        {tab === "saidas" && desk.departures.length === 0 && <Empty text={tr("Nenhuma saída pendente.")} />}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="p-6 text-center text-sm text-zinc-400">{text}</p>;
}
