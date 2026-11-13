"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { anonymizeGuestAction, anonymizeOldAction, countOldAction, searchGuestsAction } from "./actions";

type Found = { id: string; fullName: string; docNumber: string | null; email: string | null; stays: number };

export function PrivacyTools() {
  const tr = useT();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Found[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [years, setYears] = useState("5");
  const [count, setCount] = useState<number | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">{tr("Pedido de um hóspede")}</h2>
        <p className="text-sm text-zinc-500">{tr("Procure pelo nome, CPF ou telefone. “Exportar” baixa tudo o que o hotel guarda sobre a pessoa (para entregar a ela). “Anonimizar” apaga quem ela é, mantendo as estadias e os valores.")}</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => setList(await searchGuestsAction(q)));
          }}
        >
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Nome, CPF ou telefone")} />
          <button className="btn-secondary" disabled={pending || q.trim().length < 2}>{tr("Buscar")}</button>
        </form>
        {list && list.length === 0 && <p className="text-sm text-zinc-400">{tr("Nenhum hóspede encontrado.")}</p>}
        <ul className="divide-y divide-zinc-100">
          {list?.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="flex-1">
                <b>{g.fullName}</b> <span className="text-xs text-zinc-500">{[g.docNumber, g.email, tr("{0} estadia(s)", [g.stays])].filter(Boolean).join(" · ")}</span>
              </span>
              <a className="btn-secondary px-2 py-1 text-xs" href={`/configuracoes/privacidade/exportar/${g.id}`}>{tr("⬇ Exportar dados")}</a>
              <button
                className="btn-secondary px-2 py-1 text-xs text-red-700"
                disabled={pending}
                onClick={() => {
                  if (!confirm(tr("Anonimizar {0}? Nome, documento, contatos e endereço serão apagados para sempre.", [g.fullName]))) return;
                  start(async () => {
                    const r = await anonymizeGuestAction(g.id);
                    setMsg(r.ok ? { ok: true, text: tr("Hóspede anonimizado.") } : { ok: false, text: tr(r.error ?? "") });
                    if (r.ok) setList(await searchGuestsAction(q));
                  });
                }}
              >
                {tr("Anonimizar")}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">{tr("Limpeza de cadastros antigos")}</h2>
        <p className="text-sm text-zinc-500">{tr("Anonimiza quem não se hospeda há mais de X anos (o registro de hóspedes costuma ser guardado por 5 anos). Hóspedes com reserva ativa ou conta pendente ficam de fora.")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{tr("Sem estadia há mais de")}</span>
          <input className="field w-20" inputMode="numeric" value={years} onChange={(e) => { setYears(e.target.value); setCount(null); }} />
          <span className="text-sm">{tr("anos")}</span>
          <button className="btn-secondary" disabled={pending} onClick={() => start(async () => setCount(await countOldAction(Number(years))))}>{tr("Contar")}</button>
          {count !== null && (
            <button
              className="btn bg-red-600 text-white hover:bg-red-700"
              disabled={pending || count === 0}
              onClick={() => {
                if (!confirm(tr("Anonimizar {0} hóspede(s)? Não dá para desfazer.", [count]))) return;
                start(async () => {
                  const r = await anonymizeOldAction(Number(years));
                  setMsg(r.ok ? { ok: true, text: tr("{0} hóspede(s) anonimizado(s).", [r.count ?? 0]) } : { ok: false, text: tr(r.error ?? "") });
                  setCount(null);
                });
              }}
            >
              {tr("Anonimizar {0}", [count])}
            </button>
          )}
        </div>
      </section>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
