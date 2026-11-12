"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n";
import { PROBLEM_KINDS, REQUEST_LABEL, REQUEST_TYPES, STATUS_LABEL, type RequestType } from "@/lib/requests/rules";
import { sendGuestRequestAction } from "./actions";

type Req = { id: string; number: number; type: RequestType; message: string | null; status: keyof typeof STATUS_LABEL; createdAt: string };

export function GuestRequestScreen({ token, requests }: { token: string; requests: Req[] }) {
  const tr = useT();
  const router = useRouter();
  const [type, setType] = useState<RequestType | null>(null);
  const [problem, setProblem] = useState<string>("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const needsText = type === "OUTRO" || (type === "PROBLEMA" && problem === "Outro");
  const canSend = type && (type !== "PROBLEMA" || problem) && (!needsText || message.trim());

  function send() {
    if (!type) return;
    start(async () => {
      const r = await sendGuestRequestAction(token, { type, problem: problem || undefined, message });
      setResult(r.ok ? { ok: true, text: tr("Pedido enviado! A equipe já foi avisada.") } : { ok: false, text: tr(r.error ?? "Não foi possível registrar. Fale com a recepção.") });
      if (r.ok) {
        setType(null);
        setProblem("");
        setMessage("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-lg">
        <h2 className="mb-3 text-center font-semibold">{tr("Como podemos ajudar?")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {REQUEST_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setResult(null);
              }}
              className={`rounded-xl border-2 p-3 text-left text-sm font-semibold ${type === t ? "border-blue-600 bg-blue-50" : "border-zinc-200"} ${t === "OUTRO" ? "col-span-2" : ""}`}
            >
              <span className="mr-1 text-xl">{REQUEST_LABEL[t].icon}</span>
              {tr(REQUEST_LABEL[t].label)}
            </button>
          ))}
        </div>

        {type === "PROBLEMA" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PROBLEM_KINDS.map((p) => (
              <button key={p} type="button" onClick={() => setProblem(p)} className={`rounded-full border px-3 py-1 text-sm ${problem === p ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300"}`}>
                {tr(p)}
              </button>
            ))}
          </div>
        )}

        {type && (
          <div className="mt-3 space-y-2">
            <textarea
              className="w-full rounded-xl border border-zinc-300 p-3 text-base"
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={needsText ? tr("Conte em poucas palavras o que precisa.") : tr("Algum detalhe? (opcional)")}
            />
            <button type="button" disabled={!canSend || pending} onClick={send} className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white disabled:opacity-50">
              {pending ? tr("Enviando...") : tr("Enviar pedido")}
            </button>
          </div>
        )}

        {result && (
          <p className={`mt-3 rounded-xl p-3 text-center text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{result.text}</p>
        )}
      </div>

      {requests.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-lg">
          <h2 className="mb-2 font-semibold">{tr("Seus pedidos")}</h2>
          <ul className="space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0">
                <span>
                  {REQUEST_LABEL[r.type].icon} {tr(REQUEST_LABEL[r.type].label)}
                  {r.message && <span className="block text-xs text-zinc-500">{r.message}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "CONCLUIDO" ? "bg-emerald-100 text-emerald-800" : r.status === "EM_ANDAMENTO" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
                  {tr(STATUS_LABEL[r.status])}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-center text-xs text-white/70">{tr("Urgências: ligue para a recepção.")}</p>
    </div>
  );
}
