"use client";

import { FieldError } from "@/components/field-error";
import type { FieldErrors } from "@/lib/auth/validation";
import type { GuestView } from "@/lib/guests/service";

import { useT } from "@/components/i18n";
// Campos do hóspede (não controlados). Lidos com readGuest(form, prefixo).
export function GuestFields({
  prefix = "g_",
  initial,
  errors,
  requireDoc,
  compact,
}: {
  prefix?: string;
  initial?: Partial<GuestView>;
  errors?: FieldErrors;
  requireDoc?: boolean;
  compact?: boolean;
}) {
  const tr = useT();
  const n = (k: string) => `${prefix}${k}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <option value="OUTRO">{tr("Outro")}</option>
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
            <span className="text-xs text-zinc-500">{tr("Nascimento")}</span>
            <input name={n("birthDate")} type="date" className="field" defaultValue={initial?.birthDate ?? ""} />
            <FieldError messages={errors?.birthDate} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Nacionalidade")}</span>
            <input name={n("nationality")} className="field" defaultValue={initial?.nationality ?? "Brasileira"} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Cidade")}</span>
            <input name={n("city")} className="field" defaultValue={initial?.city ?? ""} />
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
  };
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
