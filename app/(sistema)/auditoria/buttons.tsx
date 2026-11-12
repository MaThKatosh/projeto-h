"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAction } from "../reservas/actions";
import { runAuditAction } from "./actions";

export function RunAuditButton({ disabled, next }: { disabled: boolean; next: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  return (
    <div className="space-y-2">
      <button
        className="btn bg-zinc-900 px-6 py-3 text-white hover:bg-zinc-700"
        disabled={disabled || pending}
        onClick={() => {
          if (!confirm(`Rodar a auditoria agora? As diárias serão lançadas e a data do sistema passará para ${next}.`)) return;
          start(async () => {
            const r = await runAuditAction();
            setMsg(r.ok ? { ok: r.message } : { error: r.error });
            router.refresh();
          });
        }}
      >
        {pending ? "Rodando a auditoria..." : "🌙 Rodar auditoria"}
      </button>
      {disabled && !msg.ok && <p className="text-xs text-zinc-500">Resolva os itens em vermelho da conferência para liberar.</p>}
      {msg.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ Auditoria concluída. {msg.ok}</p>}
      {msg.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
    </div>
  );
}

export function NoShowButton({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-secondary px-2 py-1 text-xs"
      disabled={pending}
      onClick={() => {
        const reason = prompt("Motivo (ex.: hóspede não apareceu e não atende o telefone):", "Hóspede não compareceu");
        if (!reason) return;
        start(async () => {
          const r = await cancelAction(reservationId, reason, true);
          if (!r.ok) alert(r.error);
          router.refresh();
        });
      }}
    >
      Não compareceu
    </button>
  );
}
