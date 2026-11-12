"use client";

import { FieldError } from "@/components/field-error";
import type { FieldErrors } from "@/lib/auth/validation";
import type { GuestView } from "@/lib/guests/service";
import { GENDERS, GENDER_LABEL, PURPOSE_LABEL, TRANSPORT_LABEL, TRANSPORTS, TRAVEL_PURPOSES, type TripInput } from "@/lib/guests/fnrh";

import { useRef, useState } from "react";
import { useLocale, useT } from "@/components/i18n";
import { countryOptions } from "@/lib/guests/countries";
import { birthDateProblem, isValidCpf, normalizeCep } from "@/lib/guests/validate";

// Dados que costumam ser iguais para a família toda.
const SHARED = ["phone", "email", "address", "zipCode", "city", "state", "country"] as const;

// Campos do hóspede (não controlados). Lidos com readGuest(form, prefixo).
// copyFrom: prefixo de outra ficha no mesmo formulário (ex.: "g_" = titular)
// → mostra o botão "copiar do titular".
export function GuestFields({
  prefix = "g_",
  initial,
  errors,
  requireDoc,
  compact,
  copyFrom,
  copyValues,
}: {
  prefix?: string;
  initial?: Partial<GuestView>;
  errors?: FieldErrors;
  requireDoc?: boolean;
  compact?: boolean;
  copyFrom?: string;
  copyValues?: Partial<GuestView>;
}) {
  const tr = useT();
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const n = (k: string) => `${prefix}${k}`;
  const today = new Date().toISOString().slice(0, 10);
  const minBirth = `${new Date().getFullYear() - 120}-01-01`;

  function copy() {
    const form = box.current?.closest("form");
    if (!form) return;
    for (const k of SHARED) {
      const from = copyFrom ? (form.elements.namedItem(`${copyFrom}${k}`) as HTMLInputElement | HTMLSelectElement | null)?.value : copyValues?.[k];
      const to = form.elements.namedItem(n(k)) as HTMLInputElement | HTMLSelectElement | null;
      if (from && to) to.value = from;
    }
  }

  return (
    <div ref={box} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(copyFrom || copyValues) && (
        <div className="sm:col-span-2 lg:col-span-4">
          <button type="button" className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50" onClick={copy}>
            {tr("⧉ Copiar telefone, e-mail e endereço do titular")}
          </button>
        </div>
      )}
      <label className="sm:col-span-2">
        <span className="text-xs text-zinc-500">{tr("Nome completo *")}</span>
        <input name={n("fullName")} className="field" defaultValue={initial?.fullName} required />
        <FieldError messages={errors?.fullName} />
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("Documento")}{requireDoc ? " *" : ""}</span>
        <select name={n("docType")} className="field" defaultValue={initial?.docType ?? "CPF"}>
          <option value="CPF">{tr("CPF")}</option>
          <option value="RG">{tr("RG")}</option>
          <option value="PASSAPORTE">{tr("Passaporte")}</option>
          <option value="OUTRO">{tr("Outro (certidão, RNE...)")}</option>
        </select>
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("Número")}{requireDoc ? " *" : ""}</span>
        <input name={n("docNumber")} className="field" defaultValue={initial?.docNumber ?? ""} required={requireDoc} />
        <FieldError messages={errors?.docNumber} />
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("Telefone")}</span>
        <input name={n("phone")} className="field" inputMode="tel" defaultValue={initial?.phone ?? ""} />
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("E-mail")}</span>
        <input name={n("email")} type="email" className="field" defaultValue={initial?.email ?? ""} />
        <FieldError messages={errors?.email} />
      </label>
      {!compact && (
        <>
          <label>
            <span className="text-xs text-zinc-500">{tr("Nascimento")}{requireDoc ? " *" : ""}</span>
            <input name={n("birthDate")} type="date" className="field" min={minBirth} max={today} defaultValue={initial?.birthDate ?? ""} required={requireDoc} />
            <FieldError messages={errors?.birthDate} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Nacionalidade")}{requireDoc ? " *" : ""}</span>
            <select name={n("nationality")} className="field" defaultValue={initial?.nationality === "Brasileira" || !initial?.nationality ? "Brasil" : initial.nationality}>
              {countryOptions(locale, initial?.nationality === "Brasileira" ? null : initial?.nationality).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Sexo")}{requireDoc ? " *" : ""}</span>
            <select name={n("gender")} className="field" defaultValue={initial?.gender ?? ""} required={requireDoc}>
              <option value="">—</option>
              {GENDERS.map((g) => <option key={g} value={g}>{tr(GENDER_LABEL[g])}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Profissão")}</span>
            <input name={n("profession")} className="field" defaultValue={initial?.profession ?? ""} maxLength={60} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Órgão emissor / país do documento")}</span>
            <input name={n("docIssuer")} className="field" defaultValue={initial?.docIssuer ?? ""} maxLength={40} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("País de residência")}{requireDoc ? " *" : ""}</span>
            <select name={n("country")} className="field" defaultValue={initial?.country || "Brasil"}>
              {countryOptions(locale, initial?.country).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("CEP")}</span>
            <input name={n("zipCode")} className="field" inputMode="numeric" placeholder="00000-000" defaultValue={initial?.zipCode ?? ""} maxLength={12} />
            <FieldError messages={errors?.zipCode} />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs text-zinc-500">{tr("Endereço (rua, número, bairro)")}</span>
            <input name={n("address")} className="field" defaultValue={initial?.address ?? ""} maxLength={160} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Cidade")}{requireDoc ? " *" : ""}</span>
            <input name={n("city")} className="field" defaultValue={initial?.city ?? ""} required={requireDoc} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Estado")}</span>
            <input name={n("state")} className="field" defaultValue={initial?.state ?? ""} maxLength={30} />
          </label>
        </>
      )}
    </div>
  );
}

export function readGuest(form: HTMLFormElement, prefix = "g_") {
  const f = new FormData(form);
  const get = (k: string) => String(f.get(`${prefix}${k}`) ?? "");
  return {
    fullName: get("fullName"),
    docType: get("docType"),
    docNumber: get("docNumber"),
    phone: get("phone"),
    email: get("email"),
    birthDate: get("birthDate"),
    nationality: get("nationality"),
    city: get("city"),
    state: get("state"),
    // Campos da FNRH só existem no formulário completo.
    ...(f.has(`${prefix}gender`)
      ? {
          gender: get("gender"),
          profession: get("profession"),
          docIssuer: get("docIssuer"),
          country: get("country"),
          address: get("address"),
          zipCode: get("zipCode"),
        }
      : {}),
  };
}

// Dados da viagem pedidos pela FNRH (por estadia).
export function TripFields({ initial, prefix = "t_" }: { initial?: Partial<TripInput>; prefix?: string }) {
  const tr = useT();
  const n = (k: string) => `${prefix}${k}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label>
        <span className="text-xs text-zinc-500">{tr("Motivo da viagem")}</span>
        <select name={n("travelPurpose")} className="field" defaultValue={initial?.travelPurpose ?? ""}>
          <option value="">—</option>
          {TRAVEL_PURPOSES.map((p) => <option key={p} value={p}>{tr(PURPOSE_LABEL[p])}</option>)}
        </select>
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("Meio de transporte")}</span>
        <select name={n("transport")} className="field" defaultValue={initial?.transport ?? ""}>
          <option value="">—</option>
          {TRANSPORTS.map((p) => <option key={p} value={p}>{tr(TRANSPORT_LABEL[p])}</option>)}
        </select>
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("Vem de (cidade/UF/país)")}</span>
        <input name={n("arrivingFrom")} className="field" defaultValue={initial?.arrivingFrom ?? ""} maxLength={80} />
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("Próximo destino")}</span>
        <input name={n("nextDestination")} className="field" defaultValue={initial?.nextDestination ?? ""} maxLength={80} />
      </label>
    </div>
  );
}

export function readTrip(form: HTMLFormElement, prefix = "t_") {
  const f = new FormData(form);
  const get = (k: string) => String(f.get(`${prefix}${k}`) ?? "");
  return { travelPurpose: get("travelPurpose"), transport: get("transport"), arrivingFrom: get("arrivingFrom"), nextDestination: get("nextDestination") };
}

export function VehicleFields({ prefix = "v_", errors }: { prefix?: string; errors?: FieldErrors }) {
  const tr = useT();
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <label>
        <span className="text-xs text-zinc-500">{tr("Placa")}</span>
        <input name={`${prefix}plate`} className="field uppercase" placeholder={tr("ABC1D23")} />
        <FieldError messages={errors?.plate} />
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("Modelo")}</span>
        <input name={`${prefix}model`} className="field" placeholder={tr("Ex.: Onix")} />
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("Cor")}</span>
        <input name={`${prefix}color`} className="field" />
      </label>
      <label>
        <span className="text-xs text-zinc-500">{tr("Vaga")}</span>
        <input name={`${prefix}spot`} className="field" placeholder={tr("Ex.: 12")} />
      </label>
    </div>
  );
}

// Veículo é opcional: só vai se a placa foi preenchida.
export function readVehicle(form: HTMLFormElement, prefix = "v_") {
  const f = new FormData(form);
  const plate = String(f.get(`${prefix}plate`) ?? "").trim();
  if (!plate) return undefined;
  return {
    plate,
    model: String(f.get(`${prefix}model`) ?? ""),
    color: String(f.get(`${prefix}color`) ?? ""),
    spot: String(f.get(`${prefix}spot`) ?? ""),
  };
}

// Fichas dos acompanhantes (check-in e entrada direta). Os já cadastrados
// vêm preenchidos; completa com fichas em branco até o número de pessoas.
export function CompanionsFields({ existing = [], people }: { existing?: GuestView[]; people: number }) {
  const tr = useT();
  const [extra, setExtra] = useState(0);
  const blanks = Math.max(0, people - 1 - existing.length) + extra;
  const total = existing.length + blanks;
  if (total === 0) {
    return (
      <button type="button" className="text-sm text-blue-700 underline" onClick={() => setExtra(1)}>
        {tr("+ incluir acompanhante")}
      </button>
    );
  }
  return (
    <div className="space-y-4">
      {Array.from({ length: total }, (_, i) => {
        const g = existing[i];
        return (
          <fieldset key={g?.id ?? `novo-${i}`} className="rounded-lg border border-zinc-200 p-3">
            <legend className="px-1 text-sm font-semibold">{tr("Acompanhante {0}", [i + 1])}</legend>
            {g && <input type="hidden" name={`c${i}_id`} value={g.id} />}
            <GuestFields prefix={`c${i}_`} initial={g} errors={undefined} requireDoc copyFrom="g_" />
          </fieldset>
        );
      })}
      <button type="button" className="text-sm text-blue-700 underline" onClick={() => setExtra((x) => x + 1)}>
        {tr("+ incluir outro acompanhante")}
      </button>
    </div>
  );
}

// Lê todas as fichas de acompanhantes do formulário (c0_, c1_, ...).
export function readCompanions(form: HTMLFormElement) {
  const out: (ReturnType<typeof readGuest> & { id?: string })[] = [];
  for (let i = 0; form.elements.namedItem(`c${i}_fullName`); i++) {
    const g = readGuest(form, `c${i}_`);
    const id = (form.elements.namedItem(`c${i}_id`) as HTMLInputElement | null)?.value;
    // ficha em branco (sem nome) é ignorada; o servidor confere se falta alguém
    if (!g.fullName.trim() && !id) continue;
    out.push(id ? { ...g, id } : g);
  }
  return out;
}

// Confere as fichas no próprio navegador antes de enviar: devolve a lista do
// que falta (em texto claro) e marca os campos em vermelho.
// people: fichas exigidas; fichas extras deixadas em branco são ignoradas.
export function checkGuestForms(form: HTMLFormElement, tr: (s: string, p?: unknown[]) => string, people = 1): string[] {
  const problems: string[] = [];
  const prefixes = ["g_"];
  for (let i = 0; form.elements.namedItem(`c${i}_fullName`); i++) prefixes.push(`c${i}_`);
  form.querySelectorAll("[aria-invalid=true]").forEach((el) => el.removeAttribute("aria-invalid"));
  for (const p of prefixes) {
    const el = (k: string) => form.elements.namedItem(`${p}${k}`) as HTMLInputElement | HTMLSelectElement | null;
    const val = (k: string) => (el(k)?.value ?? "").trim();
    const miss: string[] = [];
    if (p !== "g_" && Number(p.slice(1, -1)) >= people - 1 && !val("fullName") && !val("docNumber")) continue;
    const mark = (k: string, label: string) => {
      el(k)?.setAttribute("aria-invalid", "true");
      miss.push(tr(label));
    };
    if (val("fullName").split(/\s+/).filter(Boolean).length < 2) mark("fullName", "nome e sobrenome");
    if (!val("docNumber")) mark("docNumber", "documento");
    else if (val("docType") === "CPF" && !isValidCpf(val("docNumber"))) mark("docNumber", "CPF válido");
    if (!val("birthDate")) mark("birthDate", "nascimento");
    else if (birthDateProblem(val("birthDate"))) mark("birthDate", "data de nascimento válida");
    if (!val("nationality")) mark("nationality", "nacionalidade");
    if (!val("gender")) mark("gender", "sexo");
    if (!val("country")) mark("country", "país de residência");
    if (!val("city")) mark("city", "cidade");
    if (/^brasil$/i.test(val("country")) && !val("state")) mark("state", "estado");
    if (val("zipCode") && /^brasil$/i.test(val("country")) && !normalizeCep(val("zipCode"))) mark("zipCode", "CEP válido");
    if (miss.length) {
      const who = p === "g_" ? tr("Titular") : tr("Acompanhante {0}", [Number(p.slice(1, -1)) + 1]);
      problems.push(tr("{0}: falta {1}.", [who, miss.join(", ")]));
    }
  }
  return problems;
}
