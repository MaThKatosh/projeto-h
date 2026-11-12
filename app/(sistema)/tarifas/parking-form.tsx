"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/field-error";
import { centsToInput } from "@/lib/money";
import { saveParkingAction } from "./actions";

export function ParkingForm({ cents }: { cents: number }) {
  const [value, setValue] = useState(centsToInput(cents));
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; success?: string }>({});

  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveParkingAction(value);
          setState(r.ok ? { success: "Valor do estacionamento salvo." } : { error: r.error });
        });
      }}
    >
      <h2 className="font-semibold">🚗 Estacionamento</h2>
      <p className="text-sm text-zinc-500">
        Valor cobrado por noite para cada veículo na garagem, lançado junto com a diária. Deixe 0,00 se o estacionamento é grátis.
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-500">R$</span>
        <input className="field w-32" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        <span className="text-sm text-zinc-500">por noite</span>
        <button className="btn-secondary" disabled={pending}>Salvar</button>
      </div>
      <FormMessage error={state.error} success={state.success} />
    </form>
  );
}
