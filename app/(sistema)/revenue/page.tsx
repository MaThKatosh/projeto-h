import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { getBusinessDate } from "@/lib/hotel-date";
import { addDays, formatDate, isDateStr, weekday } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { forecast, lastDays, onTheBooks } from "@/lib/revenue/service";
import { describeRule, KIND_LABEL } from "@/lib/revenue/rules";
import { getT } from "@/lib/i18n/server";
import { RuleForm } from "./rule-form";

export const dynamic = "force-dynamic";

// Revenue management: quanto o hotel vai vender e por quanto vale vender.
export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ de?: string; dias?: string }> }) {
  const tr = await getT();
  await requirePermission("revenue.manage");
  const db = getDb();
  const today = await getBusinessDate(db);
  const q = await searchParams;
  const from = isDateStr(q.de) && q.de >= today ? q.de : today;
  const days = q.dias === "30" ? 30 : 14;
  const [f, next, past, types] = await Promise.all([
    forecast(db, from, days),
    onTheBooks(db, today, 30),
    lastDays(db, today, 30),
    db.roomType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const typeName = (id: string | null) => (id ? (types.find((t) => t.id === id)?.name ?? null) : null);
  const occColor = (p: number) => (p >= 85 ? "bg-red-100 text-red-800" : p >= 65 ? "bg-amber-100 text-amber-800" : p >= 35 ? "bg-emerald-50 text-emerald-800" : "bg-zinc-50 text-zinc-600");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{tr("Revenue management")}</h1>
        <p className="text-sm text-zinc-500">{tr("Ocupação prevista e preço sugerido por noite. O preço sugerido aparece na hora de fazer a reserva e é enviado ao channel manager.")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Kpi title={tr("Próximos 30 dias (já reservado)")} k={next} tr={tr} extra={tr("{0} reserva(s) feitas nos últimos 7 dias", [next.pickup7])} />
        <Kpi title={tr("Últimos 30 dias (auditoria)")} k={past} tr={tr} extra={past.audits ? tr("{0} dia(s) auditados", [past.audits]) : tr("Ainda sem auditorias.")} />
      </div>

      <section className="card overflow-x-auto p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            {tr("Calendário de preços")}{" "}
            <span className="text-sm font-normal text-zinc-500">{f.planName ? tr("(base: tarifa “{0}”)", [f.planName]) : tr("(sem tarifa ativa)")}</span>
          </h2>
          <div className="flex items-center gap-1 text-sm">
            {from > today && <Link className="btn-secondary px-2 py-1" href={`/revenue?de=${addDays(from, -days) < today ? today : addDays(from, -days)}&dias=${days}`}>←</Link>}
            <Link className={`rounded-lg px-3 py-1 ${days === 14 ? "bg-blue-600 text-white" : "bg-white"}`} href={`/revenue?de=${from}&dias=14`}>{tr("14 dias")}</Link>
            <Link className={`rounded-lg px-3 py-1 ${days === 30 ? "bg-blue-600 text-white" : "bg-white"}`} href={`/revenue?de=${from}&dias=30`}>{tr("30 dias")}</Link>
            <Link className="btn-secondary px-2 py-1" href={`/revenue?de=${addDays(from, days)}&dias=${days}`}>→</Link>
          </div>
        </div>
        <table className="w-full min-w-max border-separate border-spacing-0.5 text-center text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-2 text-left">{tr("Noite")}</th>
              {f.nights.map((n) => (
                <th key={n} className="px-1 font-normal">
                  <div className="text-zinc-500">{tr(weekday(n))}</div>
                  <div className="font-semibold">{formatDate(n)}</div>
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 bg-white px-2 text-left font-normal text-zinc-500">{tr("Ocupação do hotel")}</th>
              {f.hotelOcc.map((o, i) => (
                <th key={i} className={`rounded px-1 py-0.5 ${occColor(o)}`}>{o}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.rows.map((row) => (
              <tr key={row.roomTypeId}>
                <td className="sticky left-0 bg-white px-2 text-left font-semibold whitespace-nowrap">{row.name}</td>
                {row.cells.map((c) => {
                  const s = c.suggestion;
                  const up = s && s.adjustBp > 0;
                  const down = s && s.adjustBp < 0;
                  return (
                    <td
                      key={c.date}
                      className={`rounded px-1 py-1 ${up ? "bg-emerald-50" : down ? "bg-sky-50" : "bg-zinc-50"}`}
                      title={s?.applied.length ? s.applied.map((a) => `${a.name} ${a.adjustBp > 0 ? "+" : ""}${a.adjustBp / 100}%`).join("\n") : tr("Sem regra: preço base")}
                    >
                      <div className={`font-semibold ${up ? "text-emerald-700" : down ? "text-sky-700" : ""}`}>{s ? formatBRL(s.price).replace(",00", "") : "—"}</div>
                      <div className="text-[10px] text-zinc-500">{tr("{0} livre(s)", [c.free])}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-zinc-500">{tr("Verde: preço acima da base · azul: abaixo. Passe o mouse sobre um preço para ver as regras que valeram.")}</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">{tr("Regras de preço")}</h2>
        <p className="text-sm text-zinc-500">{tr("Os ajustes das regras que valem para a noite se somam (entre -50% e +200%). Ex.: sábado (+10%) com ocupação alta (+15%) = +25%.")}</p>
        {f.rules.length === 0 && <p className="text-sm text-zinc-400">{tr("Nenhuma regra ainda: o preço sugerido é o da tarifa base.")}</p>}
        <ul className="space-y-2">
          {f.rules.map((r) => (
            <li key={r.id}>
              <RuleForm
                types={types}
                rule={r}
                summary={`${KIND_LABEL[r.kind].icon} ${r.name} · ${describeRule(r, typeName(r.roomTypeId))} · ${r.adjustBp > 0 ? "+" : ""}${r.adjustBp / 100}%${r.active ? "" : ` · ${tr("desligada")}`}`}
              />
            </li>
          ))}
        </ul>
        <RuleForm types={types} />
      </section>
    </div>
  );
}

function Kpi({ title, k, extra, tr }: { title: string; k: { occupancyPct: number; adrCents: number; revparCents: number; roomNights: number }; extra: string; tr: (s: string, p?: unknown[]) => string }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-zinc-500">{tr("Ocupação")}</div>
          <div className="text-xl font-black">{k.occupancyPct.toLocaleString("pt-BR")}%</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500" title={tr("Diária média: receita de diárias ÷ quartos vendidos")}>{tr("Diária média (ADR)")}</div>
          <div className="text-xl font-black">{formatBRL(k.adrCents)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500" title={tr("Receita de diárias ÷ quartos disponíveis")}>{tr("RevPAR")}</div>
          <div className="text-xl font-black">{formatBRL(k.revparCents)}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-500">{tr("{0} quarto(s)-noite", [k.roomNights])} · {extra}</div>
    </div>
  );
}
