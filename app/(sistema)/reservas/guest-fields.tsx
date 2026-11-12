"use client";

import { FieldError } from "@/components/field-error";
import type { FieldErrors } from "@/lib/auth/validation";
import type { GuestView } from "@/lib/guests/service";
import { GENDERS, GENDER_LABEL, PURPOSE_LABEL, TRANSPORT_LABEL, TRANSPORTS, TRAVEL_PURPOSES, type TripInput } from "@/lib/guests/fnrh";

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
          <label>
            <span className="text-xs text-zinc-500">{tr("Sexo")}</span>
            <select name={n("gender")} className="field" defaultValue={initial?.gender ?? ""}>
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
            <span className="text-xs text-zinc-500">{tr("País de residência")}</span>
            <input name={n("country")} className="field" defaultValue={initial?.country ?? "Brasil"} maxLength={40} />
          </label>
          <label className="sm:col-span-2 lg:col-span-3">
            <span className="text-xs text-zinc-500">{tr("Endereço (rua, número, bairro)")}</span>
            <input name={n("address")} className="field" defaultValue={initial?.address ?? ""} maxLength={160} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("CEP")}</span>
            <input name={n("zipCode")} className="field" inputMode="numeric" defaultValue={initial?.zipCode ?? ""} maxLength={12} />
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
