"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/field-error";
import { centsToInput } from "@/lib/money";
import { saveParkingAction } from "./actions";

import { useT } from "@/components/i18n";
export function ParkingForm({ cents, spots }: { cents: number; spots: number }) {
  const tr = useT();
  const [value, setValue] = useState(centsToInput(cents));
  const [spotsText, setSpotsText] = useState(String(spots));
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; success?: string }>({});

  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveParkingAction(value, spotsText);
          setState(r.ok ? { success: "Estacionamento salvo." } : { error: r.error });
        });
      }}
    >
      <h2 className="font-semibold">{tr("🚗 Estacionamento")}</h2>
      <p className="text-sm text-zinc-500">{tr("Valor cobrado por noite para cada veículo na garagem, lançado junto com a diária. Deixe 0,00 se o estacionamento é grátis.")}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-500">{tr("R$")}</span>
        <input className="field w-32" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        <span className="text-sm text-zinc-500">{tr("por noite")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">{tr("Vagas")}</span>
        <input className="field w-24" inputMode="numeric" value={spotsText} onChange={(e) => setSpotsText(e.target.value)} />
        <span className="text-sm text-zinc-500">{tr("(0 = sem limite; com a garagem lotada o sistema não deixa registrar outro veículo)")}</span>
      </div>
      <button className="btn-secondary" disabled={pending}>{tr("Salvar")}</button>
      <FormMessage error={state.error} success={state.success} />
    </form>
  );
}
