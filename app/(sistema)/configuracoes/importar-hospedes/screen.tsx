"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { importGuestsAction, previewGuestsAction, type GuestPreview } from "./actions";

const TEMPLATE = "nome;cpf;nascimento;email;telefone;sexo;cidade;estado;pais;cep;endereco\r\nMaria da Silva;529.982.247-25;20/05/1985;maria@exemplo.com;11 99999-0000;F;São Paulo;SP;Brasil;01001-000;Rua A, 10\r\n";

async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

const STYLE = { novo: "bg-emerald-100 text-emerald-800", existe: "bg-zinc-100 text-zinc-600", erro: "bg-red-100 text-red-700" } as const;
const LABEL = { novo: "Novo", existe: "Já existe", erro: "Problema" } as const;

export function GuestImport() {
  const tr = useT();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<GuestPreview[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const count = (a: GuestPreview["action"]) => rows?.filter((r) => r.action === a).length ?? 0;

  return (
    <div className="space-y-4">
      <section className="card space-y-2 p-5">
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          className="field"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const t = await readText(f);
            setText(t);
            setMsg(null);
            start(async () => {
              const r = await previewGuestsAction(t);
              setRows(r.rows ?? null);
              if (r.error) setMsg({ ok: false, text: tr(r.error) });
            });
          }}
        />
        <a className="text-xs text-blue-700 underline" download="modelo-hospedes.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + TEMPLATE)}`}>{tr("Baixar modelo")}</a>
      </section>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      {rows && (
        <section className="card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            {(["novo", "existe", "erro"] as const).map((a) => (
              <span key={a} className={`rounded px-2 py-0.5 text-xs font-semibold ${STYLE[a]}`}>{tr(LABEL[a])}: {count(a)}</span>
            ))}
            <button
              className="btn-primary ml-auto"
              disabled={pending || count("novo") === 0}
              onClick={() =>
                start(async () => {
                  const r = await importGuestsAction(text);
                  setMsg(r.error ? { ok: false, text: tr(r.error) } : { ok: true, text: tr("{0} hóspede(s) importado(s).", [r.created ?? 0]) });
                  if (!r.error) setRows(null);
                })
              }
            >
              {tr("Importar {0} hóspede(s)", [count("novo")])}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr><th>{tr("Linha")}</th><th>{tr("O que fazer")}</th><th>{tr("Nome")}</th><th>{tr("Documento")}</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r) => (
                <tr key={r.line} className="border-t border-zinc-100">
                  <td className="py-1 text-zinc-500">{r.line}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STYLE[r.action]}`}>{tr(LABEL[r.action])}</span>
                    {r.reason && <span className="ml-1 text-xs text-zinc-500">{tr(r.reason)}</span>}
                  </td>
                  <td>{r.name}</td>
                  <td>{r.doc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 500 && <p className="mt-2 text-xs text-zinc-500">{tr("Mostrando as primeiras 500 linhas.")}</p>}
        </section>
      )}
    </div>
  );
}
