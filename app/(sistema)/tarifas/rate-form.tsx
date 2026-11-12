"use client";

import { useState, useTransition } from "react";
import { FieldError, FormMessage } from "@/components/field-error";
import { centsToInput } from "@/lib/money";
import type { RatePlanView } from "@/lib/rates/service";
import type { FieldErrors } from "@/lib/auth/validation";
import { saveRatePlanAction } from "./actions";

export function RatePlanForm({
  plan,
  types,
}: {
  plan?: RatePlanView;
  types: { id: string; name: string; capacity: number }[];
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; success?: string; fieldErrors?: FieldErrors }>({});
  const [chargeIss, setChargeIss] = useState(plan?.chargeIss ?? true);

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    const input = {
      name: f.get("name"),
      includesBreakfast: f.get("includesBreakfast") === "on",
      chargeIss: f.get("chargeIss") === "on",
      issPercent: String(f.get("issPercent") ?? "0").replace(",", "."),
      active: plan ? f.get("active") === "on" : true,
      prices: Object.fromEntries(types.map((t) => [t.id, String(f.get(`price_${t.id}`) ?? "")])),
    };
    start(async () => {
      const r = await saveRatePlanAction(plan?.id ?? null, input);
      if (r.ok) {
        setState({ success: plan ? "Tarifa salva." : "Tarifa criada." });
        if (!plan) form.reset();
      } else setState({ error: r.error, fieldErrors: r.fieldErrors });
    });
  }

  return (
    <form
      className={`card space-y-4 p-5 ${plan && !plan.active ? "opacity-60" : ""} ${plan ? "" : "border-dashed"}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1">
          <span className="text-xs text-zinc-500">{plan ? "Nome da tarifa" : "Nova tarifa"}</span>
          <input name="name" className="field" defaultValue={plan?.name} placeholder="Ex.: Booking, Corporativo" required />
          <FieldError messages={state.fieldErrors?.name} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="includesBreakfast" defaultChecked={plan?.includesBreakfast ?? true} /> Inclui café da manhã
        </label>
        {plan && (
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={plan.active} /> Ativa
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-zinc-50 p-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="chargeIss" checked={chargeIss} onChange={(e) => setChargeIss(e.target.checked)} /> Cobrar ISS sobre a diária
        </label>
        <label className={`flex items-center gap-2 ${chargeIss ? "" : "opacity-40"}`}>
          alíquota
          <input
            name="issPercent"
            className="field w-20"
            inputMode="decimal"
            defaultValue={plan ? String(plan.issBasisPoints / 100).replace(".", ",") : "5"}
            disabled={!chargeIss}
          />
          %
        </label>
        <FieldError messages={state.fieldErrors?.issPercent} />
      </div>

      <div>
        <div className="mb-2 text-xs text-zinc-500">Diária por tipo de quarto (deixe vazio se este tipo não é vendido nesta tarifa)</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {types.map((t) => (
            <label key={t.id}>
              <span className="text-xs">{t.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-zinc-500">R$</span>
                <input
                  name={`price_${t.id}`}
                  className="field"
                  inputMode="decimal"
                  defaultValue={plan?.prices[t.id] !== undefined ? centsToInput(plan.prices[t.id]) : ""}
                  placeholder="0,00"
                />
              </div>
              <FieldError messages={state.fieldErrors?.[`price_${t.id}`]} />
            </label>
          ))}
        </div>
      </div>

      <FormMessage error={state.fieldErrors ? undefined : state.error} success={state.success} />
      <button type="submit" className={plan ? "btn-secondary" : "btn-primary"} disabled={pending}>
        {pending ? "Salvando..." : plan ? "Salvar tarifa" : "+ Criar tarifa"}
      </button>
    </form>
  );
}
