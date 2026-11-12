import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { getBusinessDate } from "@/lib/hotel-date";
import { addDays, formatDate, isDateStr } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { dailyReport, openAccounts } from "@/lib/folio/service";
import { posPaymentsByDay } from "@/lib/restaurant/service";
import { pendingPaymentsByDay } from "@/lib/pending/service";
import { CATEGORY_LABEL, METHOD, METHODS, type Category } from "@/lib/folio/rules";
import { LiveRefresher } from "@/components/live-refresher";
import { clock } from "@/components/time";

import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const tr = await getT();
  await requirePermission("finance.view");
  const db = getDb();
  const today = await getBusinessDate(db);
  const { data } = await searchParams;
  const date = isDateStr(data) && data <= today ? data : today;
  const [report, accounts, pos, pend] = await Promise.all([dailyReport(db, date), openAccounts(db), posPaymentsByDay(db, date), pendingPaymentsByDay(db, date)]);
  // Borderô = contas dos quartos + o que o restaurante recebeu na hora.
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, report.byMethod[m] + pos.byMethod[m] + pend.byMethod[m]])) as typeof report.byMethod;
  const totalReceived = report.totalReceived + pos.total + pend.total;
  const reversals = report.entries.filter((e) => e.reversalOfId || e.isRefund);
  const owed = accounts.reduce((s, a) => s + Math.max(0, a.balance), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("Financeiro")}</h1>
          <LiveRefresher types={["reservations.changed"]} />
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary px-3 py-1.5" href={`/financeiro?data=${addDays(date, -1)}`}>{tr("← dia anterior")}</Link>
          <form action="/financeiro" className="flex items-center gap-2">
            <input type="date" name="data" defaultValue={date} max={today} className="field w-40" />
            <button className="btn-secondary px-3 py-1.5">{tr("Ver")}</button>
          </form>
          {date < today && <Link className="btn-secondary px-3 py-1.5" href="/financeiro">{tr("Hoje")}</Link>}
          <Link className="btn-secondary px-3 py-1.5" href="/financeiro/pendentes">{tr("⏳ Contas pendentes")}</Link>
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">{tr("Borderô de {0}", [formatDate(date, true)])}{" "}<span className="text-sm font-normal text-zinc-500">{tr("(pelo dia do sistema em que foi lançado)")}</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {METHODS.map((m) => (
            <div key={m} className={`rounded-xl p-3 ${METHOD[m].color}`}>
              <div className="text-xs">{tr(METHOD[m].icon)} {tr(METHOD[m].label)}</div>
              <div className="text-xl font-black">{formatBRL(byMethod[m])}</div>
              {pos.byMethod[m] > 0 && <div className="text-[11px]">{tr("restaurante:")}{" "}{formatBRL(pos.byMethod[m])}</div>}
              {pend.byMethod[m] > 0 && <div className="text-[11px]">{tr("pendentes:")}{" "}{formatBRL(pend.byMethod[m])}</div>}
            </div>
          ))}
          <div className="rounded-xl bg-zinc-900 p-3 text-white">
            <div className="text-xs">{tr("Total recebido")}</div>
            <div className="text-xl font-black">{formatBRL(totalReceived)}</div>
            {(pos.total > 0 || pend.total > 0) && (
              <div className="text-[11px]">{tr("quartos {0} · restaurante {1} · pendentes {2}", [formatBRL(report.totalReceived), formatBRL(pos.total), formatBRL(pend.total)])}</div>
            )}
            <Link href="/relatorios/bordero" className="text-[11px] underline">{tr("por usuário e setor →")}</Link>
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">{tr("Estornos e devoluções já estão descontados.")}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">{tr("Cobranças lançadas no dia")}</h2>
          <dl className="space-y-1 text-sm">
            {(Object.entries(report.byCategory) as [Category, number][]).map(([c, v]) => (
              <div key={c} className="flex justify-between">
                <dt className="text-zinc-600">{tr(CATEGORY_LABEL[c])}</dt>
                <dd className="font-medium">{formatBRL(v)}</dd>
              </div>
            ))}
            {Object.keys(report.byCategory).length === 0 && <p className="text-zinc-400">{tr("Nenhuma.")}</p>}
            <div className="flex justify-between border-t border-zinc-200 pt-1 font-bold">
              <dt>{tr("Total")}</dt>
              <dd>{formatBRL(report.totalCharged)}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-2 font-semibold">{tr("Estornos e devoluções do dia ({0})", [reversals.length])}</h2>
          {reversals.length === 0 ? (
            <p className="text-sm text-zinc-400">{tr("Nenhum.")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {reversals.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 rounded bg-red-50 px-2 py-1">
                  <span>
                    <Link href={`/reservas/${e.reservationId}`} className="font-semibold underline">{tr("nº")}{" "}{e.reservationNumber}</Link> · {e.description}
                    <span className="block text-xs text-zinc-500">{e.createdByName}{" "}{tr("às")}{" "}{clock(e.createdAt)}</span>
                  </span>
                  <b className="whitespace-nowrap">{formatBRL(e.amountCents)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{tr("Contas abertas (hóspedes na casa)")}</h2>
          <span className="text-sm">{tr("A receber:")}{" "}<b>{formatBRL(owed)}</b></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr className="border-b border-zinc-200">
                <th className="py-2">{tr("Quarto")}</th>
                <th className="py-2">{tr("Hóspede")}</th>
                <th className="py-2">{tr("Sai")}</th>
                <th className="py-2">{tr("Diárias a lançar")}</th>
                <th className="py-2 text-right">{tr("Saldo")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-zinc-100">
                  <td className="py-2 font-bold">{a.roomNumber}</td>
                  <td className="py-2"><Link href={`/reservas/${a.id}`} className="text-blue-700 underline">{a.guestName}</Link></td>
                  <td className={`py-2 ${a.checkOut <= today ? "font-bold text-amber-700" : ""}`}>{formatDate(a.checkOut)}</td>
                  <td className="py-2">{a.pendingNights > 0 ? <span className="text-amber-700">{a.pendingNights}</span> : "—"}</td>
                  <td className={`py-2 text-right font-semibold ${a.balance > 0 ? "text-red-700" : a.balance < 0 ? "text-sky-700" : "text-emerald-700"}`}>
                    {a.balance === 0 ? tr("zerada") : a.balance > 0 ? formatBRL(a.balance) : tr("crédito {0}", [formatBRL(-a.balance)])}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-zinc-400">{tr("Nenhum hóspede na casa.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-2 font-semibold">{tr("Todos os lançamentos do dia ({0})", [report.entries.length])}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr className="border-b border-zinc-200">
                <th className="py-2">{tr("Hora")}</th>
                <th className="py-2">{tr("Reserva")}</th>
                <th className="py-2">{tr("Lançamento")}</th>
                <th className="py-2">{tr("Por")}</th>
                <th className="py-2 text-right">{tr("Cobrança")}</th>
                <th className="py-2 text-right">{tr("Pagamento")}</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((e) => (
                <tr key={e.id} className={`border-b border-zinc-100 ${e.reversedAt ? "text-zinc-400 line-through" : ""}`}>
                  <td className="py-1.5 text-xs">{clock(e.createdAt)}</td>
                  <td className="py-1.5"><Link href={`/reservas/${e.reservationId}`} className="underline">{tr("nº")}{" "}{e.reservationNumber}</Link> {e.roomNumber && <span className="text-xs text-zinc-500">· {e.roomNumber}</span>}</td>
                  <td className="py-1.5">{e.description}</td>
                  <td className="py-1.5 text-xs">{e.createdByName}</td>
                  <td className="py-1.5 text-right">{e.kind === "COBRANCA" ? formatBRL(e.amountCents) : ""}</td>
                  <td className="py-1.5 text-right">{e.kind === "PAGAMENTO" ? formatBRL(e.amountCents) : ""}</td>
                </tr>
              ))}
              {report.entries.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-zinc-400">{tr("Nenhum lançamento neste dia.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
