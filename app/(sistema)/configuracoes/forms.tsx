"use client";

import { useState, useTransition } from "react";
import { FieldError, FormMessage } from "@/components/field-error";
import { METHOD, METHODS, type Method } from "@/lib/folio/rules";
import { LOCALE_LABEL, LOCALES, type Locale } from "@/lib/i18n/locales";
import type { HotelSettings } from "@/lib/settings";
import type { FieldErrors } from "@/lib/auth/validation";
import { saveBrandAction, saveHotelAction } from "./actions";

export function HotelForm({ settings }: { settings: HotelSettings }) {
  const [s, setS] = useState(settings);
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ ok?: string; error?: string; fieldErrors?: FieldErrors }>({});
  const toggle = (m: Method) =>
    setS((p) => ({ ...p, enabledMethods: p.enabledMethods.includes(m) ? p.enabledMethods.filter((x) => x !== m) : [...p.enabledMethods, m] }));

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveHotelAction(s);
          setState(r.ok ? { ok: "Configurações salvas." } : { error: r.error, fieldErrors: r.fieldErrors });
        });
      }}
    >
      <h2 className="font-semibold">🏢 Hotel</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="text-xs text-zinc-500">Nome do hotel (aparece no menu e no login)</span>
          <input className="field" value={s.hotelName} maxLength={60} onChange={(e) => setS({ ...s, hotelName: e.target.value })} />
          <FieldError messages={state.fieldErrors?.hotelName} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">Horário de check-in</span>
          <input type="time" className="field" value={s.checkInTime} onChange={(e) => setS({ ...s, checkInTime: e.target.value })} />
          <FieldError messages={state.fieldErrors?.checkInTime} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">Horário de check-out</span>
          <input type="time" className="field" value={s.checkOutTime} onChange={(e) => setS({ ...s, checkOutTime: e.target.value })} />
          <FieldError messages={state.fieldErrors?.checkOutTime} />
        </label>
      </div>

      <label className="block max-w-sm">
        <span className="text-xs text-zinc-500">Idioma padrão do sistema (cada funcionário pode trocar o seu em “Meu perfil”)</span>
        <select className="field" value={s.defaultLocale} onChange={(e) => setS({ ...s, defaultLocale: e.target.value as Locale })}>
          {LOCALES.map((l) => (
            <option key={l} value={l}>{LOCALE_LABEL[l]}</option>
          ))}
        </select>
      </label>

      <div>
        <div className="mb-1 text-xs text-zinc-500">Formas de pagamento aceitas</div>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm ${s.enabledMethods.includes(m) ? "border-blue-600 bg-blue-50" : "border-zinc-200 text-zinc-500"}`}>
              <input type="checkbox" checked={s.enabledMethods.includes(m)} onChange={() => toggle(m)} />
              {METHOD[m].icon} {METHOD[m].label}
            </label>
          ))}
        </div>
        <FieldError messages={state.fieldErrors?.enabledMethods} />
      </div>

      <FormMessage error={state.fieldErrors ? undefined : state.error} success={state.ok} />
      <button className="btn-primary" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</button>
    </form>
  );
}

export function BrandRow({ brand }: { brand?: { id: string; name: string; active: boolean; sortOrder: number } }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text?: string }>({});
  return (
    <form
      className={`flex flex-wrap items-center gap-2 rounded-lg p-2 ${brand ? (brand.active ? "bg-zinc-50" : "bg-zinc-100 opacity-60") : "border border-dashed border-zinc-300"}`}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        start(async () => {
          const r = await saveBrandAction(brand?.id ?? null, { name: f.get("name"), sortOrder: f.get("sortOrder"), active: brand ? f.get("active") === "on" : true });
          const fieldMsg = r.fieldErrors ? Object.values(r.fieldErrors).flat()[0] : undefined;
          setMsg(r.ok ? { ok: true, text: brand ? "Salvo." : "Bandeira criada." } : { ok: false, text: fieldMsg ?? r.error });
          if (r.ok && !brand) form.reset();
        });
      }}
    >
      <input name="name" className="field w-48" defaultValue={brand?.name} placeholder="Nova bandeira" required maxLength={30} />
      <label className="flex items-center gap-1 text-xs">
        ordem <input name="sortOrder" type="number" min={0} max={99} className="field w-16" defaultValue={brand?.sortOrder ?? 10} />
      </label>
      {brand && (
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="active" defaultChecked={brand.active} /> Ativa
        </label>
      )}
      <button className={brand ? "btn-secondary px-3 py-1.5" : "btn-primary px-3 py-1.5"} disabled={pending}>{brand ? "Salvar" : "+ Bandeira"}</button>
      {msg.text && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
    </form>
  );
}
