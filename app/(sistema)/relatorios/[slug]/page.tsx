import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { formatDate } from "@/lib/dates";
import { formatCell, totals } from "@/lib/reports/engine";
import { runReport } from "@/lib/reports/run";
import { PrintButton } from "./print-button";
import { dateTime } from "@/components/time";

export const dynamic = "force-dynamic";

export default async function RelatorioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ de?: string; ate?: string; filtro?: string }>;
}) {
  const { user } = await verifySession();
  const { slug } = await params;
  const query = await searchParams;
  const data = await runReport(getDb(), user.role, slug, query);
  if (!data) notFound();
  const { def, from, to, filter, result } = data;
  const t = totals(result);
  const qs = new URLSearchParams({ de: from, ate: to, ...(filter ? { filtro: filter } : {}) }).toString();
  const period = def.period === "none" ? "agora" : def.period === "day" ? formatDate(from, true) : from === to ? formatDate(from, true) : `${formatDate(from, true)} a ${formatDate(to, true)}`;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/relatorios" className="text-sm text-blue-700 underline">← Relatórios</Link>
          <h1 className="text-2xl font-bold">{def.title}</h1>
          <p className="text-sm text-zinc-500">{def.description}</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <a className="btn-secondary" href={`/relatorios/${def.slug}/arquivo?${qs}`}>⬇ Excel (CSV)</a>
        </div>
      </div>

      {def.period !== "none" && (
        <form className="no-print card flex flex-wrap items-end gap-3 p-3" action={`/relatorios/${def.slug}`}>
          <label>
            <span className="text-xs text-zinc-500">{def.period === "day" ? "Dia" : "De"}</span>
            <input type="date" name="de" defaultValue={from} className="field" />
          </label>
          {def.period === "range" && (
            <label>
              <span className="text-xs text-zinc-500">Até</span>
              <input type="date" name="ate" defaultValue={to} className="field" />
            </label>
          )}
          {def.filter && (
            <label>
              <span className="text-xs text-zinc-500">{def.filter.label}</span>
              <select name="filtro" defaultValue={filter ?? ""} className="field">
                <option value="">Todos</option>
                {def.filter.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          )}
          <button className="btn-primary">Ver</button>
        </form>
      )}

      {/* Cabeçalho que só aparece na impressão */}
      <div className="print-only">
        <h1 className="text-xl font-bold">{def.title}</h1>
        <p className="text-sm">Período: {period}{filter ? ` · ${def.filter?.options.find((o) => o.value === filter)?.label}` : ""} · emitido por {user.fullName} em {dateTime(data.generatedAt)}</p>
      </div>

      {result.summary && result.summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.summary.map((s) => (
            <div key={s.label} className="card px-4 py-2">
              <div className="text-xs text-zinc-500">{s.label}</div>
              <div className="text-lg font-bold">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              {result.columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 whitespace-nowrap ${isNumeric(c.type) ? "text-right" : ""}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr key={i} className="border-t border-zinc-100">
                {result.columns.map((c) => (
                  <td key={c.key} className={`px-3 py-1.5 ${isNumeric(c.type) ? "text-right whitespace-nowrap" : ""} ${c.type === "money" && Number(r[c.key]) < 0 ? "text-red-700" : ""}`}>
                    {formatCell(r[c.key], c.type)}
                  </td>
                ))}
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={result.columns.length} className="px-3 py-8 text-center text-zinc-400">Nada encontrado neste período.</td>
              </tr>
            )}
          </tbody>
          {t && (
            <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-bold">
              <tr>
                {result.columns.map((c, i) => (
                  <td key={c.key} className={`px-3 py-2 ${isNumeric(c.type) ? "text-right whitespace-nowrap" : ""}`}>
                    {i === 0 ? `Total (${result.rows.length})` : c.key in t ? formatCell(t[c.key], c.type) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {result.note && <p className="text-xs text-zinc-500">{result.note}</p>}
    </div>
  );
}

function isNumeric(type?: string) {
  return type === "money" || type === "int" || type === "percent";
}
