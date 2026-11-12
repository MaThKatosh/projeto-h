"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { FormMessage } from "@/components/field-error";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { SOURCE_LABEL, type Source } from "@/lib/reservations/rules";
import { TEMPLATE_CSV } from "@/lib/integrations/parse";
import type { ImportAction, PlanRow } from "@/lib/integrations/service";
import { applyImportAction, previewImportAction, type ApplyResult } from "./actions";

const PORTALS: Source[] = ["BOOKING", "HOTEIS_COM", "EXPEDIA", "DECOLAR", "AIRBNB", "AGENCIA", "SITE", "OUTRO"];

const ACTION_STYLE: Record<ImportAction, { label: string; cls: string }> = {
  criar: { label: "Nova", cls: "bg-emerald-100 text-emerald-800" },
  alterar: { label: "Alterar", cls: "bg-sky-100 text-sky-800" },
  cancelar: { label: "Cancelar", cls: "bg-amber-100 text-amber-800" },
  ignorar: { label: "Ignorar", cls: "bg-zinc-100 text-zinc-600" },
  erro: { label: "Problema", cls: "bg-red-100 text-red-700" },
};

// Planilha do Excel no Windows costuma vir em Windows-1252, não UTF-8.
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

export function ImportScreen({ types }: { types: { id: string; name: string }[] }) {
  const tr = useT();
  const [source, setSource] = useState<Source>("BOOKING");
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [typeMap, setTypeMap] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [breakfast, setBreakfast] = useState(true);
  const [chargeIss, setChargeIss] = useState(false);
  const [issPercent, setIssPercent] = useState("5");
  const [results, setResults] = useState<ApplyResult["results"] | null>(null);
  const [pending, start] = useTransition();

  function preview(nextText = text, nextSource = source, nextMap = typeMap) {
    if (!nextText) return;
    setResults(null);
    start(async () => {
      const r = await previewImportAction({ text: nextText, source: nextSource, typeMap: nextMap });
      setError(r.ok ? undefined : r.error);
      setRows(r.rows ?? null);
      setLabels(r.labels ?? []);
      // Guarda o palpite automático de cada tipo do portal.
      if (r.rows) {
        const guessed = { ...(r.typeMap ?? {}), ...nextMap };
        for (const row of r.rows) if (row.roomTypeId && guessed[row.roomTypeLabel] === undefined) guessed[row.roomTypeLabel] = row.roomTypeId;
        setTypeMap(guessed);
      }
    });
  }

  const counts = useMemo(() => {
    const c: Record<ImportAction, number> = { criar: 0, alterar: 0, cancelar: 0, ignorar: 0, erro: 0 };
    for (const r of rows ?? []) c[r.action]++;
    return c;
  }, [rows]);
  const toApply = counts.criar + counts.alterar + counts.cancelar;

  function apply() {
    start(async () => {
      const r = await applyImportAction({ text, source, typeMap, breakfast, chargeIss, issPercent });
      setError(r.ok ? undefined : r.error);
      if (r.results) {
        setResults(r.results);
        setRows(null);
      }
    });
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + TEMPLATE_CSV)}`;

  return (
    <div className="space-y-4">
      <section className="card grid gap-4 p-5 md:grid-cols-3">
        <label>
          <span className="text-xs text-zinc-500">{tr("Portal")}</span>
          <select
            className="field"
            value={source}
            onChange={(e) => {
              const s = e.target.value as Source;
              setSource(s);
              preview(text, s);
            }}
          >
            {PORTALS.map((p) => <option key={p} value={p}>{tr(SOURCE_LABEL[p])}</option>)}
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="text-xs text-zinc-500">{tr("Arquivo CSV")}</span>
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="field"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFileName(f.name);
              const t = await readText(f);
              setText(t);
              setTypeMap({});
              preview(t, source, {});
            }}
          />
          <span className="mt-1 block text-xs text-zinc-500">
            {tr("Booking.com: Extranet → Reservas → baixar (CSV). Veio em Excel (.xlsx)? Abra e use “Salvar como → CSV”.")}{" "}
            <a href={templateHref} download="modelo-reservas.csv" className="text-blue-700 underline">{tr("Baixar modelo")}</a>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-4 text-sm md:col-span-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={breakfast} onChange={(e) => setBreakfast(e.target.checked)} />{tr("Café da manhã incluso")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={chargeIss} onChange={(e) => setChargeIss(e.target.checked)} />{tr("Cobrar ISS por fora")}</label>
          {chargeIss && (
            <label className="flex items-center gap-2">{tr("ISS %")}<input className="field w-20" inputMode="decimal" value={issPercent} onChange={(e) => setIssPercent(e.target.value)} /></label>
          )}
          <span className="text-xs text-zinc-500">{tr("Valem para as reservas novas deste arquivo.")}</span>
        </div>
      </section>

      <FormMessage error={error} />
      {pending && <p className="text-sm text-zinc-500">{tr("Lendo...")}</p>}

      {rows && labels.length > 0 && (
        <section className="card space-y-2 p-5">
          <h2 className="font-semibold">{tr("Tipos de quarto do portal → do hotel")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {labels.map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm">
                <span className="w-1/2 truncate" title={l}>{l || tr("(sem tipo no arquivo)")}</span>
                <select
                  className="field"
                  value={typeMap[l] ?? ""}
                  onChange={(e) => {
                    const m = { ...typeMap, [l]: e.target.value };
                    setTypeMap(m);
                    preview(text, source, m);
                  }}
                >
                  <option value="">{tr("— escolha —")}</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      {rows && (
        <section className="card overflow-x-auto p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <b>{fileName}</b>
            {(Object.keys(ACTION_STYLE) as ImportAction[]).map((a) =>
              counts[a] ? <span key={a} className={`rounded px-2 py-0.5 text-xs font-semibold ${ACTION_STYLE[a].cls}`}>{tr(ACTION_STYLE[a].label)}: {counts[a]}</span> : null
            )}
            <button type="button" className="btn-primary ml-auto" disabled={pending || toApply === 0} onClick={apply}>
              {tr("Importar {0} reserva(s)", [toApply])}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="py-1">{tr("Linha")}</th>
                <th>{tr("O que fazer")}</th>
                <th>{tr("Código")}</th>
                <th>{tr("Hóspede")}</th>
                <th>{tr("Entrada")}</th>
                <th>{tr("Saída")}</th>
                <th>{tr("Tipo no portal")}</th>
                <th className="text-right">{tr("Total")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line} className="border-t border-zinc-100 align-top">
                  <td className="py-1 text-zinc-500">{r.line}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ACTION_STYLE[r.action].cls}`}>{tr(ACTION_STYLE[r.action].label)}</span>
                    {r.reservationNumber && <span className="ml-1 text-xs text-zinc-500">nº {r.reservationNumber}</span>}
                    {r.reason && <div className="text-xs text-zinc-500">{tr(r.reason)}</div>}
                  </td>
                  <td>{r.externalCode}</td>
                  <td>{r.guestName}</td>
                  <td>{r.checkIn ? formatDate(r.checkIn, true) : ""}</td>
                  <td>{r.checkOut ? formatDate(r.checkOut, true) : ""}</td>
                  <td className="text-xs">{r.roomTypeLabel}</td>
                  <td className="text-right">{r.totalCents !== null ? formatBRL(r.totalCents) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {results && (
        <section className="card overflow-x-auto p-5">
          <h2 className="mb-2 font-semibold">{tr("Resultado")}</h2>
          <ul className="space-y-1 text-sm">
            {results.map((r) => (
              <li key={r.line} className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ACTION_STYLE[r.action].cls}`}>{tr(ACTION_STYLE[r.action].label)}</span>
                <span>{r.externalCode} · {r.guestName}</span>
                {r.reservationId && <Link className="text-blue-700 underline" href={`/reservas/${r.reservationId}`}>{tr("reserva nº {0}", [r.number])}</Link>}
                {r.reason && <span className="text-xs text-zinc-500">{tr(r.reason)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
