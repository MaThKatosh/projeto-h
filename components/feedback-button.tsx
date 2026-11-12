"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n";
import { sendFeedbackAction } from "@/app/(sistema)/sugestoes/actions";

// Versão de teste: botão fixo para o testador mandar sugestão ou erro.
export function FeedbackButton() {
  const tr = useT();
  const page = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("ERRO");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="no-print fixed right-4 bottom-4 z-50">
      {open ? (
        <div className="w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <b>{tr("💬 Enviar sugestão ou erro")}</b>
            <button className="text-zinc-400" onClick={() => setOpen(false)} aria-label={tr("Fechar")}>✕</button>
          </div>
          <div className="flex gap-1 text-sm">
            {[
              ["ERRO", "🐞 Erro"],
              ["SUGESTAO", "💡 Sugestão"],
              ["ELOGIO", "👍 Gostei"],
            ].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-lg border px-2 py-1 ${kind === k ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300"}`}>
                {tr(l)}
              </button>
            ))}
          </div>
          <textarea
            className="field"
            rows={4}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={tr("O que aconteceu ou o que poderia ser melhor? (a tela atual vai junto)")}
          />
          {result && <p className="text-sm text-emerald-700">{tr(result)}</p>}
          <button
            className="btn-primary w-full"
            disabled={pending || message.trim().length < 3}
            onClick={() =>
              start(async () => {
                const r = await sendFeedbackAction({ kind, message, page, device: navigator.userAgent.slice(0, 200) });
                setResult(r.ok ? "Obrigado! Recebido." : (r.error ?? "Não foi possível enviar."));
                if (r.ok) setMessage("");
              })
            }
          >
            {pending ? tr("Enviando...") : tr("Enviar")}
          </button>
        </div>
      ) : (
        <button onClick={() => { setOpen(true); setResult(null); }} className="rounded-full bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-amber-600">
          {tr("💬 Sugestão / erro")}
        </button>
      )}
    </div>
  );
}
