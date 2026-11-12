"use client";

import { useState, useTransition } from "react";
import { advanceDateAction } from "../reservas/actions";

// Provisório até a auditoria noturna (Fase 6).
export function AdvanceDateButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="btn-secondary px-2 py-1 text-xs"
        disabled={pending}
        onClick={() => {
          if (!confirm("Avançar a data do sistema em 1 dia? Faça isso só depois de conferir chegadas e saídas do dia.")) return;
          start(async () => {
            const r = await advanceDateAction();
            setError(r.ok ? null : (r.error ?? "Não foi possível."));
          });
        }}
      >
        Avançar data do sistema →
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
