"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n";
import { FieldError, FormMessage } from "@/components/field-error";
import { KIND_LABEL, RULE_KINDS, WEEKDAYS, type Rule, type RuleKind } from "@/lib/revenue/rules";
import type { FieldErrors } from "@/lib/auth/validation";
import { deleteRuleAction, saveRuleAction } from "./actions";

// Uma regra: resumo com "editar", ou o formulário (nova regra / edição).
export function RuleForm({ types, rule, summary }: { types: { id: string; name: string }[]; rule?: Rule; summary?: string }) {
  const tr = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RuleKind>(rule?.kind ?? "DIA_SEMANA");
  const [name, setName] = useState(rule?.name ?? "");
  const [adjust, setAdjust] = useState(rule ? String(rule.adjustBp / 100) : "10");
  const [typeId, setTypeId] = useState(rule?.roomTypeId ?? "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [minOcc, setMinOcc] = useState(String(rule?.params.minOccupancy ?? 70));
  const [days, setDays] = useState<number[]>(rule?.params.days ?? [5, 6]);
  const [from, setFrom] = useState(rule?.params.from ?? "");
  const [to, setTo] = useState(rule?.params.to ?? "");
  const [ahead, setAhead] = useState(String(rule?.params.maxDaysAhead ?? 2));
  const [state, setState] = useState<{ error?: string; fieldErrors?: FieldErrors }>({});
  const [pending, start] = useTransition();

  if (!open) {
    return rule ? (
      <div className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${rule.active ? "border-zinc-200" : "border-dashed border-zinc-300 text-zinc-400"}`}>
        <span>{summary}</span>
        <button className="text-blue-700 underline" onClick={() => setOpen(true)}>{tr("editar")}</button>
      </div>
    ) : (
      <button className="btn-secondary" onClick={() => setOpen(true)}>{tr("+ Nova regra")}</button>
    );
  }

  const save = () =>
    start(async () => {
      const r = await saveRuleAction(rule?.id ?? null, {
        name,
        kind,
        adjustPercent: adjust.replace(",", "."),
        roomTypeId: typeId,
        active,
        ...(kind === "OCUPACAO" ? { minOccupancy: minOcc } : {}),
        ...(kind === "DIA_SEMANA" ? { days } : {}),
        ...(kind === "PERIODO" ? { from, to } : {}),
        ...(kind === "ANTECEDENCIA" ? { maxDaysAhead: ahead } : {}),
      });
      if (r.ok) {
        setOpen(false);
        setState({});
        router.refresh();
      } else setState({ error: r.error, fieldErrors: r.fieldErrors });
    });

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {RULE_KINDS.map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-lg border px-3 py-1.5 ${kind === k ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300 bg-white"}`} title={tr(KIND_LABEL[k].hint)}>
            {KIND_LABEL[k].icon} {tr(KIND_LABEL[k].label)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="text-xs text-zinc-500">{tr("Nome")}</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Ex.: Fim de semana")} maxLength={60} />
          <FieldError messages={state.fieldErrors?.name} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">{tr("Ajuste (%)")}</span>
          <input className="field" inputMode="decimal" value={adjust} onChange={(e) => setAdjust(e.target.value)} />
          <span className="text-[11px] text-zinc-500">{tr("negativo = desconto")}</span>
          <FieldError messages={state.fieldErrors?.adjustPercent} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">{tr("Tipo de quarto")}</span>
          <select className="field" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">{tr("Todos")}</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </div>

      {kind === "OCUPACAO" && (
        <label className="block">
          <span className="text-xs text-zinc-500">{tr("Quando a ocupação prevista do hotel na noite chegar a (%)")}</span>
          <input className="field w-28" inputMode="numeric" value={minOcc} onChange={(e) => setMinOcc(e.target.value)} />
          <FieldError messages={state.fieldErrors?.minOccupancy} />
        </label>
      )}
      {kind === "DIA_SEMANA" && (
        <div>
          <span className="text-xs text-zinc-500">{tr("Noites de")}</span>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))} className={`rounded-lg border px-3 py-1 ${days.includes(i) ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300 bg-white"}`}>
                {tr(d)}
              </button>
            ))}
          </div>
          <FieldError messages={state.fieldErrors?.days} />
        </div>
      )}
      {kind === "PERIODO" && (
        <div className="flex flex-wrap gap-3">
          <label>
            <span className="text-xs text-zinc-500">{tr("De")}</span>
            <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
            <FieldError messages={state.fieldErrors?.from} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Até")}</span>
            <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
            <FieldError messages={state.fieldErrors?.to} />
          </label>
        </div>
      )}
      {kind === "ANTECEDENCIA" && (
        <label className="block">
          <span className="text-xs text-zinc-500">{tr("Faltando até quantos dias para a noite (0 = no próprio dia)")}</span>
          <input className="field w-28" inputMode="numeric" value={ahead} onChange={(e) => setAhead(e.target.value)} />
          <FieldError messages={state.fieldErrors?.maxDaysAhead} />
        </label>
      )}

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{tr("Regra ligada")}
      </label>
      <FormMessage error={state.fieldErrors ? undefined : state.error} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending} onClick={save}>{tr("Salvar regra")}</button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>{tr("Cancelar")}</button>
        {rule && (
          <button
            className="btn-secondary ml-auto text-red-700"
            disabled={pending}
            onClick={() => {
              if (!confirm(tr("Apagar esta regra?"))) return;
              start(async () => {
                await deleteRuleAction(rule.id);
                router.refresh();
              });
            }}
          >
            {tr("Apagar")}
          </button>
        )}
      </div>
    </div>
  );
}
