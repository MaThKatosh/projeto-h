"use client";

import { useState, useTransition } from "react";
import { centsToInput } from "@/lib/money";
import { saveMenuItemAction, saveServiceFeeAction, saveTableAction, type ActionResult } from "../restaurante/actions";

import { useT } from "@/components/i18n";
function useSave() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text?: string }>({});
  const save = (fn: () => Promise<ActionResult>, ok: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      const firstField = r.fieldErrors ? Object.values(r.fieldErrors).flat()[0] : undefined;
      setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: firstField ?? r.error });
      if (r.ok) after?.();
    });
  return { pending, msg, save };
}

type Item = { id: string; name: string; group: string; priceCents: number; kitchen: boolean; active: boolean };

export function MenuRow({ item, outlet }: { item?: Item; outlet: "RESTAURANTE" | "FRIGOBAR" }) {
  const tr = useT();
  const { pending, msg, save } = useSave();
  return (
    <form
      className={`grid items-end gap-2 rounded-lg p-2 sm:grid-cols-[2fr_1.2fr_7rem_auto_auto_auto] ${item ? (item.active ? "bg-zinc-50" : "bg-zinc-100 opacity-60") : "border border-dashed border-zinc-300"}`}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        save(
          () =>
            saveMenuItemAction(item?.id ?? null, {
              outlet,
              name: f.get("name"),
              group: f.get("group"),
              price: f.get("price"),
              kitchen: outlet === "RESTAURANTE" && f.get("kitchen") === "on",
              active: item ? f.get("active") === "on" : true,
            }),
          item ? "Salvo." : "Item criado.",
          () => !item && form.reset()
        );
      }}
    >
      <label>
        {!item && <span className="text-xs text-zinc-500">{tr("Novo item")}</span>}
        <input name="name" className="field" defaultValue={item?.name} placeholder={tr("Nome")} required />
      </label>
      <input name="group" className="field" defaultValue={item?.group ?? (outlet === "FRIGOBAR" ? "Bebidas" : "")} placeholder={tr("Grupo (ex.: Pratos)")} required />
      <input name="price" className="field" inputMode="decimal" defaultValue={item ? centsToInput(item.priceCents) : ""} placeholder={tr("R$ 0,00")} required />
      {outlet === "RESTAURANTE" ? (
        <label className="flex items-center gap-1 pb-2 text-xs"><input type="checkbox" name="kitchen" defaultChecked={item?.kitchen ?? true} />{" "}{tr("Cozinha")}</label>
      ) : (
        <span />
      )}
      {item ? (
        <label className="flex items-center gap-1 pb-2 text-xs"><input type="checkbox" name="active" defaultChecked={item.active} />{" "}{tr("Ativo")}</label>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <button className={item ? "btn-secondary px-3 py-1.5" : "btn-primary px-3 py-1.5"} disabled={pending}>{item ? tr("Salvar") : tr("+ Criar")}</button>
        {msg.text && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{tr(msg.text)}</span>}
      </div>
    </form>
  );
}

export function TableRow({ table }: { table?: { id: string; name: string; seats: number; active: boolean } }) {
  const tr = useT();
  const { pending, msg, save } = useSave();
  return (
    <form
      className={`flex flex-wrap items-center gap-2 rounded-lg p-2 ${table ? (table.active ? "bg-zinc-50" : "bg-zinc-100 opacity-60") : "border border-dashed border-zinc-300"}`}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        save(
          () => saveTableAction(table?.id ?? null, { name: f.get("name"), seats: f.get("seats"), active: table ? f.get("active") === "on" : true }),
          table ? "Salvo." : "Mesa criada.",
          () => !table && form.reset()
        );
      }}
    >
      <input name="name" className="field w-28" defaultValue={table?.name} placeholder={tr("Mesa (nº)")} required />
      <label className="flex items-center gap-1 text-xs">
        <input name="seats" type="number" min={1} max={30} className="field w-16" defaultValue={table?.seats ?? 4} />{" "}{tr("lugares")}</label>
      {table && <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={table.active} />{" "}{tr("Ativa")}</label>}
      <button className={table ? "btn-secondary px-3 py-1.5" : "btn-primary px-3 py-1.5"} disabled={pending}>{table ? tr("Salvar") : tr("+ Mesa")}</button>
      {msg.text && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{tr(msg.text)}</span>}
    </form>
  );
}

export function ServiceFeeForm({ percent }: { percent: number }) {
  const tr = useT();
  const [value, setValue] = useState(String(percent).replace(".", ","));
  const { pending, msg, save } = useSave();
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">{tr("Taxa de serviço")}</h2>
      <p className="text-sm text-zinc-500">{tr("Percentual sugerido nas comandas novas (o garçom pode tirar em cada comanda). Use 0 para não cobrar.")}</p>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save(() => saveServiceFeeAction(value), "Taxa salva.");
        }}
      >
        <input className="field w-20" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /> %
        <button className="btn-secondary" disabled={pending}>{tr("Salvar")}</button>
        {msg.text && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{tr(msg.text)}</span>}
      </form>
    </section>
  );
}
