"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAction } from "../reservas/actions";
import { runAuditAction, undoAuditAction } from "./actions";

import { useT } from "@/components/i18n";
export function RunAuditButton({ disabled, next }: { disabled: boolean; next: string }) {
  const tr = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  return (
    <div className="space-y-2">
      <button
        className="btn bg-zinc-900 px-6 py-3 text-white hover:bg-zinc-700"
        disabled={disabled || pending}
        onClick={() => {
          if (!confirm(tr("Rodar a auditoria agora? As diárias serão lançadas e a data do sistema passará para {0}.", [next]))) return;
          start(async () => {
            const r = await runAuditAction();
            setMsg(r.ok ? { ok: r.message } : { error: r.error });
            router.refresh();
          });
        }}
      >
        {pending ? tr("Rodando a auditoria...") : tr("🌙 Rodar auditoria")}
      </button>
      {disabled && !msg.ok && <p className="text-xs text-zinc-500">{tr("Resolva os itens em vermelho da conferência para liberar.")}</p>}
      {msg.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{tr("✓ Auditoria concluída.")}{" "}{tr(msg.ok)}</p>}
      {msg.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{tr(msg.error)}</p>}
    </div>
  );
}

export function NoShowButton({ reservationId }: { reservationId: string }) {
  const tr = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-secondary px-2 py-1 text-xs"
      disabled={pending}
      onClick={() => {
        const reason = prompt(tr("Motivo (ex.: hóspede não apareceu e não atende o telefone):"), tr("Hóspede não compareceu"));
        if (!reason) return;
        start(async () => {
          const r = await cancelAction(reservationId, reason, true);
          if (!r.ok) alert(r.error);
          router.refresh();
        });
      }}
    >{tr("Não compareceu")}</button>
  );
}

export function UndoAuditButton({ date }: { date: string }) {
  const tr = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-sm">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-zinc-600">{tr("Rodou a auditoria por engano (ou duas vezes)? Desfazer estorna as diárias que ela lançou e volta a data do sistema para {0}.", [date])}</span>
          <button className="btn-secondary px-3 py-1.5" onClick={() => setOpen(true)}>{tr("↶ Desfazer a auditoria de")}{" "}{date}</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("Motivo (ex.: rodei antes da última chegada)")} maxLength={300} autoFocus />
          <div className="flex gap-2">
            <button
              className="btn bg-zinc-900 text-white"
              disabled={pending || reason.trim().length < 5}
              onClick={() =>
                start(async () => {
                  const r = await undoAuditAction(reason);
                  setMsg(r.ok ? { ok: r.message } : { error: r.error });
                  if (r.ok) setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? tr("Desfazendo...") : tr("Confirmar")}
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>{tr("Voltar")}</button>
          </div>
        </div>
      )}
      {msg.ok && <p className="mt-2 text-emerald-700">✓ {tr(msg.ok)}</p>}
      {msg.error && <p className="mt-2 text-red-700">{tr(msg.error)}</p>}
    </div>
  );
}
