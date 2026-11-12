import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { auditChecklist, auditHistory } from "@/lib/night-audit/service";
import { addDays, formatDate, localToday } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { LiveRefresher } from "@/components/live-refresher";
import { dateTime } from "@/components/time";
import { NoShowButton, RunAuditButton, UndoAuditButton } from "./buttons";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const { user } = await requirePermission("audit.run");
  const db = getDb();
  const [check, history] = await Promise.all([auditChecklist(db), auditHistory(db, 15)]);
  const calendar = localToday();
  const lastValid = history.find((h) => !h.undoneAt);
  // Só a última auditoria, e só se a data do sistema ainda é a que ela deixou.
  const undoable = can(user.role, "undo") && lastValid && check.today === addDays(lastValid.businessDate, 1);

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Auditoria noturna</h1>
          <LiveRefresher types={["reservations.changed", "restaurant.changed"]} />
        </div>
        <div className="card px-4 py-2 text-right">
          <div className="text-xs text-zinc-500">Data do sistema</div>
          <div className="text-xl font-black">{formatDate(check.today, true)}</div>
          {check.today < calendar && <div className="text-xs font-semibold text-amber-700">atrasada: o calendário já está em {formatDate(calendar)}</div>}
        </div>
      </div>

      <p className="text-sm text-zinc-600">
        A auditoria fecha o dia do hotel: lança a diária desta noite de todos os hóspedes (com ISS e garagem), guarda os números
        do dia e vira a data do sistema para {formatDate(check.next, true)}. Faça à noite, depois das últimas chegadas.
      </p>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">1. Conferência</h2>

        <Check ok={check.arrivals.length === 0} title="Chegadas do dia resolvidas" hint="Cada reserva para hoje precisa de check-in, “não compareceu”, cancelamento ou nova data.">
          {check.arrivals.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm">
              <span>
                <Link href={`/reservas/${r.id}`} className="font-semibold underline">nº {r.number}</Link> · {r.guestName}
                {r.roomNumber && ` · quarto ${r.roomNumber}`} · chegada {formatDate(r.date)}
              </span>
              <span className="flex gap-2">
                <Link href={`/reservas/${r.id}?acao=checkin`} className="btn-secondary px-2 py-1 text-xs">Check-in</Link>
                <NoShowButton reservationId={r.id} />
              </span>
            </li>
          ))}
        </Check>

        <Check ok={check.departures.length === 0} title="Saídas do dia resolvidas" hint="Quem devia sair hoje precisa fazer check-out ou ter a estadia prorrogada.">
          {check.departures.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm">
              <span>
                <Link href={`/reservas/${r.id}`} className="font-semibold underline">nº {r.number}</Link> · {r.guestName} · quarto {r.roomNumber} · saída {formatDate(r.date)}
              </span>
              <span className="flex gap-2">
                <Link href={`/reservas/${r.id}?acao=checkout`} className="btn-secondary px-2 py-1 text-xs">Check-out</Link>
                <Link href={`/reservas/${r.id}`} className="btn-secondary px-2 py-1 text-xs">Prorrogar</Link>
              </span>
            </li>
          ))}
        </Check>

        <Check ok={check.openComandas.length === 0} warn title="Comandas do restaurante" hint="Não impede a auditoria, mas o que for fechado depois entra no dia seguinte.">
          {check.openComandas.map((c) => (
            <li key={c.id} className="rounded-lg bg-amber-50 px-3 py-2 text-sm">
              <Link href={`/restaurante/comanda/${c.id}`} className="underline">Comanda nº {c.number}</Link> · {c.place} ainda aberta
            </li>
          ))}
        </Check>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">2. O que vai acontecer</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            <b>{check.preview.nights}</b> diária(s) lançada(s) para <b>{check.preview.guests}</b> hóspede(s): <b>{formatBRL(check.preview.total)}</b> (com ISS e garagem).
          </li>
          <li>Os números do dia {formatDate(check.today)} ficam guardados (ocupação, receita, recebido) para os relatórios.</li>
          <li>A data do sistema passa para <b>{formatDate(check.next, true)}</b>.</li>
        </ul>
        {check.tooEarly && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
            O dia {formatDate(check.today)} ainda não chegou ao fim. A próxima auditoria pode ser feita a partir da noite de {formatDate(check.today, true)}.
          </p>
        )}
        <RunAuditButton disabled={!check.canRun} next={formatDate(check.next, true)} />
      </section>

      <section className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Auditorias anteriores</h2>
          <Link href="/relatorios/ocupacao" className="text-sm text-blue-700 underline">relatório de ocupação</Link>
        </div>
        {undoable && lastValid && <div className="mb-3"><UndoAuditButton date={formatDate(lastValid.businessDate, true)} /></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr className="border-b border-zinc-200">
                <th className="py-2">Dia fechado</th>
                <th className="py-2">Ocupação</th>
                <th className="py-2">Diárias lançadas</th>
                <th className="py-2 text-right">Receita</th>
                <th className="py-2 text-right">Recebido</th>
                <th className="py-2">Feita por</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className={`border-b border-zinc-100 ${h.undoneAt ? "text-zinc-400" : ""}`}>
                  <td className="py-2 font-semibold">
                    <span className={h.undoneAt ? "line-through" : ""}>{formatDate(h.businessDate, true)}</span>
                    {h.undoneAt && <span className="block text-xs font-normal text-red-700">desfeita por {h.undoneByName}: {h.undoReason}</span>}
                  </td>
                  <td className="py-2">{h.roomsOccupied}/{h.roomsAvailable} ({h.roomsAvailable ? Math.round((h.roomsOccupied / h.roomsAvailable) * 100) : 0}%)</td>
                  <td className="py-2">{h.nightsPosted} · {formatBRL(h.nightsCents)}</td>
                  <td className="py-2 text-right">{formatBRL(h.revenueCents)}</td>
                  <td className="py-2 text-right">{formatBRL(h.receivedCents)}</td>
                  <td className="py-2 text-xs">{h.by}{h.finishedAt && <span className="block text-zinc-400">{dateTime(h.finishedAt)}</span>}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-zinc-400">Nenhuma auditoria ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Check({ ok, warn, title, hint, children }: { ok: boolean; warn?: boolean; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${ok ? "bg-emerald-600 text-white" : warn ? "bg-amber-400 text-amber-950" : "bg-red-600 text-white"}`}>
        {ok ? "✓" : "!"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        {!ok && <p className="mb-2 text-xs text-zinc-500">{hint}</p>}
        {!ok && <ul className="space-y-1">{children}</ul>}
      </div>
    </div>
  );
}
