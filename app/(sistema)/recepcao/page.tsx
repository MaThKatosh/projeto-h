import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { getBusinessDate } from "@/lib/hotel-date";
import { formatDate, localToday, nightsBetween } from "@/lib/dates";
import { frontDesk, type ReservationRow } from "@/lib/reservations/service";
import { displayStatus, DISPLAY } from "@/lib/rooms/status";
import { LiveRefresher } from "@/components/live-refresher";

import { getT, tServer } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

export default async function RecepcaoPage() {
  const tr = await getT();
  const { user } = await requirePermission("reservations.view");
  const db = getDb();
  const today = await getBusinessDate(db);
  const [desk, rooms] = await Promise.all([
    frontDesk(db, today),
    db.room.findMany({ where: { active: true }, select: { id: true, occupancy: true, housekeeping: true, maintenance: true } }),
  ]);
  const roomState = new Map(rooms.map((r) => [r.id, r]));
  const sellable = rooms.filter((r) => r.maintenance !== "BLOQUEADO" && r.maintenance !== "EM_MANUTENCAO").length;
  const ready = rooms.filter((r) => displayStatus(r) === "LIVRE").length;
  const canManage = can(user.role, "reservations.manage");
  const behind = today < localToday();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("Recepção")}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            <LiveRefresher types={["reservations.changed", "room.updated", "rooms.changed"]} />
            <span>{tr("Data do sistema:")}{" "}<b>{formatDate(today, true)}</b></span>
            {can(user.role, "audit.run") && behind && (
              <Link href="/auditoria" className="btn-secondary px-2 py-1 text-xs">{tr("🌙 Ir para a auditoria")}</Link>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Link href="/reservas/nova?direto=1" className="btn-secondary py-3">{tr("🛎 Entrada direta")}</Link>
            <Link href="/reservas/nova" className="btn-primary py-3">{tr("+ Nova reserva")}</Link>
          </div>
        )}
      </div>

      {behind && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{tr("O calendário já está em {0}, mas a data do sistema ainda é {1}. A data só vira quando a auditoria noturna for rodada.", [formatDate(localToday(), true), formatDate(today, true)])}</p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={tr("Chegadas a fazer")} value={desk.arrivals.length} tone="sky" />
        <Stat label={tr("Saídas a fazer")} value={desk.departures.length} tone="amber" />
        <Stat label={tr("Quartos ocupados")} value={desk.inHouse.rooms} hint={tr("{0}% de ocupação", [sellable ? Math.round((desk.inHouse.rooms / sellable) * 100) : 0])} tone="blue" />
        <Stat label={tr("Hóspedes na casa")} value={desk.inHouse.adults + desk.inHouse.children} hint={desk.inHouse.children ? tr("{0} criança(s)", [desk.inHouse.children]) : undefined} />
        <Stat label={tr("Quartos prontos")} value={ready} tone="emerald" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full bg-sky-500" />{tr("Chegadas")}</h2>
          <div className="space-y-2">
            {desk.arrivals.map((r) => {
              const room = r.roomId ? roomState.get(r.roomId) : undefined;
              const status = room ? displayStatus(room) : null;
              return (
                <Card key={r.id} r={r} today={today}>
                  <div className="text-xs">
                    {r.roomNumber ? (
                      <span className="flex items-center gap-1">{tr("Quarto")}{" "}<b>{r.roomNumber}</b>
                        {status && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${DISPLAY[status].card}`}>
                            {status === "LIVRE" ? tr("pronto") : tr(DISPLAY[status].label.toLowerCase())}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-amber-700">{tr("sem quarto definido")}</span>
                    )}
                  </div>
                  {canManage && <Link href={`/reservas/${r.id}?acao=checkin`} className="btn bg-emerald-600 text-white hover:bg-emerald-700">{tr("Check-in")}</Link>}
                </Card>
              );
            })}
            {desk.arrivals.length === 0 && <Empty text="Nenhuma chegada pendente." />}
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full bg-amber-500" />{tr("Saídas")}</h2>
          <div className="space-y-2">
            {desk.departures.map((r) => (
              <Card key={r.id} r={r} today={today}>
                <div className="text-xs">{tr("Quarto")}{" "}<b>{r.roomNumber}</b>{r.vehicles ? ` · 🚗 ${r.vehicles}` : ""}</div>
                {canManage && <Link href={`/reservas/${r.id}?acao=checkout`} className="btn bg-blue-600 text-white hover:bg-blue-700">{tr("Check-out")}</Link>}
              </Card>
            ))}
            {desk.departures.length === 0 && <Empty text="Nenhuma saída pendente." />}
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ r, today, children }: { r: ReservationRow; today: string; children: React.ReactNode }) {
  const tr = tServer();
  const late = r.status === "CONFIRMADA" ? r.checkIn < today : r.checkOut < today;
  return (
    <div className={`card flex flex-wrap items-center justify-between gap-3 p-3 ${late ? "border-red-300" : ""}`}>
      <div className="min-w-0">
        <Link href={`/reservas/${r.id}`} className="font-semibold hover:underline">{r.guestName}</Link>
        <div className="text-xs text-zinc-500">{tr("nº {0} · {1} · {2} noite(s) · {3} → {4} · {5}{6} pessoa(s)", [r.number, r.roomTypeName, nightsBetween(r.checkIn, r.checkOut), formatDate(r.checkIn), formatDate(r.checkOut), r.adults, r.children ? `+${r.children}` : ""])}{late && <b className="text-red-600">{" "}{tr("· atrasado")}</b>}
        </div>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "sky" | "amber" | "blue" | "emerald" }) {
  const tr = tServer();
  const bar = { sky: "border-l-sky-500", amber: "border-l-amber-500", blue: "border-l-blue-600", emerald: "border-l-emerald-500" }[tone ?? "sky"];
  return (
    <div className={`card border-l-4 px-4 py-2 ${tone ? bar : "border-l-zinc-300"}`}>
      <div className="text-xs text-zinc-500">{tr(label)}</div>
      <div className="text-2xl leading-tight font-bold">{value}</div>
      {hint && <div className="text-xs text-zinc-500">{tr(hint)}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  const tr = tServer();
  return <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-400">{tr(text)}</p>;
}
