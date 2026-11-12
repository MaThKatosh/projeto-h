"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FieldError, FormMessage } from "@/components/field-error";
import type { FieldErrors } from "@/lib/auth/validation";
import type { GuestView } from "@/lib/guests/service";
import type { RatePlanView } from "@/lib/rates/service";
import type { Availability } from "@/lib/reservations/service";
import { addDays, formatDate, nightsBetween, type DateStr } from "@/lib/dates";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { computeTotals, SOURCE_LABEL, SOURCES, type Source } from "@/lib/reservations/rules";
import { GuestFields, readGuest, readVehicle, VehicleFields } from "./guest-fields";
import {
  availabilityAction,
  createReservationAction,
  freeRoomsAction,
  readyRoomsAction,
  searchGuestsAction,
  updateReservationAction,
  walkInAction,
} from "./actions";

import { useT } from "@/components/i18n";
type Mode = "nova" | "direto" | "editar";
type RoomOption = { id: string; number: string; roomTypeId: string; typeName: string; problem?: boolean };

export type StayInitial = {
  checkIn: DateStr;
  checkOut: DateStr;
  adults?: number;
  children?: number;
  roomTypeId?: string;
  ratePlanId?: string | null;
  dailyCents?: number;
  breakfast?: boolean;
  chargeIss?: boolean;
  issBasisPoints?: number;
  source?: Source;
  externalCode?: string | null;
  notes?: string | null;
  roomId?: string | null;
};

export function StayForm({
  mode,
  today,
  plans,
  types,
  initial,
  reservationId,
  inHouse,
  onDone,
}: {
  mode: Mode;
  today: DateStr;
  plans: RatePlanView[];
  types: { id: string; name: string; capacity: number }[];
  initial: StayInitial;
  reservationId?: string;
  inHouse?: boolean;
  onDone?: () => void;
}) {
  const tr = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<{ error?: string; fieldErrors?: FieldErrors }>({});

  const defaultPlan = plans.find((p) => p.id === initial.ratePlanId) ?? (mode === "editar" ? undefined : plans[0]);
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [adults, setAdults] = useState(initial.adults ?? 2);
  const [children, setChildren] = useState(initial.children ?? 0);
  const [roomTypeId, setRoomTypeId] = useState(initial.roomTypeId ?? "");
  const [ratePlanId, setRatePlanId] = useState(defaultPlan?.id ?? "");
  const [daily, setDaily] = useState(initial.dailyCents !== undefined ? centsToInput(initial.dailyCents) : "");
  const [breakfast, setBreakfast] = useState(initial.breakfast ?? defaultPlan?.includesBreakfast ?? true);
  const [chargeIss, setChargeIss] = useState(initial.chargeIss ?? defaultPlan?.chargeIss ?? false);
  const [issPercent, setIssPercent] = useState(String((initial.issBasisPoints ?? defaultPlan?.issBasisPoints ?? 500) / 100).replace(".", ","));
  const [source, setSource] = useState<Source>(initial.source ?? (mode === "direto" ? "BALCAO" : "TELEFONE"));
  const [roomId, setRoomId] = useState(initial.roomId ?? "");
  const [showOtherTypes, setShowOtherTypes] = useState(false);

  const [avail, setAvail] = useState<Availability[] | null>(null);
  const [rooms, setRooms] = useState<RoomOption[] | null>(null);

  // Hóspede (só na nova reserva)
  const [guest, setGuest] = useState<GuestView | null>(null);
  const [newGuest, setNewGuest] = useState(mode === "direto");

  const validDates = checkOut > checkIn;
  const nights = validDates ? nightsBetween(checkIn, checkOut) : 0;

  useEffect(() => {
    let alive = true;
    if (!validDates) return;
    availabilityAction(checkIn, checkOut, reservationId).then((a) => alive && setAvail(a));
    (mode === "direto" ? readyRoomsAction(checkIn, checkOut) : freeRoomsAction(checkIn, checkOut, reservationId)).then(
      (r) => alive && setRooms(r)
    );
    return () => {
      alive = false;
    };
  }, [checkIn, checkOut, validDates, mode, reservationId]);

  function applyPlan(planId: string, typeId: string) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    const price = plan.prices[typeId];
    if (price !== undefined) setDaily(centsToInput(price));
    setBreakfast(plan.includesBreakfast);
    setChargeIss(plan.chargeIss);
    setIssPercent(String(plan.issBasisPoints / 100).replace(".", ","));
  }

  const dailyCents = parseBRL(daily);
  const issBp = Math.round(Number(issPercent.replace(",", ".")) * 100) || 0;
  const totals = dailyCents !== null && nights > 0 ? computeTotals({ nights, dailyCents, chargeIss, issBasisPoints: issBp }) : null;
  const typeCapacity = types.find((t) => t.id === roomTypeId)?.capacity;
  const roomChoices = (rooms ?? []).filter((r) => showOtherTypes || !roomTypeId || r.roomTypeId === roomTypeId);

  function stayPayload() {
    const f = new FormData(formRef.current!);
    return {
      checkIn,
      checkOut,
      adults,
      children,
      roomTypeId,
      ratePlanId,
      daily,
      breakfast,
      chargeIss,
      issPercent: issPercent.replace(",", "."),
      source,
      externalCode: String(f.get("externalCode") ?? ""),
      notes: String(f.get("notes") ?? ""),
      roomId,
    };
  }

  function submit() {
    setErrors({});
    if (mode === "nova" && !guest && !newGuest) {
      setErrors({ error: "Escolha o hóspede na busca ou cadastre um novo." });
      return;
    }
    const form = formRef.current!;
    const stay = stayPayload();
    start(async () => {
      let result;
      if (mode === "editar") {
        result = await updateReservationAction(reservationId!, stay);
        if (result.ok) {
          onDone?.();
          return;
        }
      } else if (mode === "direto") {
        result = await walkInAction({ stay, guest: readGuest(form), vehicle: readVehicle(form) });
      } else {
        result = await createReservationAction(guest ? { guestId: guest.id, stay } : { guest: readGuest(form), stay });
      }
      if (result.ok && result.id) router.push(`/reservas/${result.id}`);
      else setErrors({ error: result.error, fieldErrors: result.fieldErrors });
    });
  }

  const fe = errors.fieldErrors;

  // O que ainda falta para o botão liberar — dito na tela, em vez de só
  // deixar o botão apagado.
  const missing = [
    !validDates && "a saída precisa ser depois da entrada",
    !roomTypeId && (mode === "direto" ? "escolha o quarto (ou o tipo de quarto)" : "escolha o tipo de quarto"),
    mode === "direto" && roomTypeId && !roomId && "escolha o quarto",
    dailyCents === null && "informe o valor da diária",
  ].filter(Boolean).map((m) => tr(m as string));

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* HÓSPEDE */}
      {mode !== "editar" && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">{tr("1. Hóspede")}</h2>
          {mode === "nova" && !newGuest && !guest && <GuestSearch onPick={setGuest} onNew={() => setNewGuest(true)} />}
          {guest && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 p-3">
              <div>
                <div className="font-semibold">{guest.fullName}</div>
                <div className="text-xs text-zinc-600">
                  {[guest.docType && guest.docNumber ? `${guest.docType} ${guest.docNumber}` : null, guest.phone, guest.email].filter(Boolean).join(" · ") || tr("sem contato")}
                </div>
              </div>
              <button type="button" className="text-sm text-blue-700 underline" onClick={() => setGuest(null)}>{tr("trocar")}</button>
            </div>
          )}
          {newGuest && (
            <>
              <GuestFields errors={fe} requireDoc={mode === "direto"} />
              {mode === "nova" && (
                <button type="button" className="text-sm text-blue-700 underline" onClick={() => setNewGuest(false)}>{tr("← buscar hóspede já cadastrado")}</button>
              )}
            </>
          )}
        </section>
      )}

      {/* DATAS E QUARTO */}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">{mode === "editar" ? tr("Estadia") : tr("2. Estadia")}</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className="text-xs text-zinc-500">{tr("Entrada")}</span>
            <input
              type="date"
              className="field"
              value={checkIn}
              min={mode === "editar" && inHouse ? undefined : today}
              disabled={mode === "direto" || inHouse}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1));
              }}
            />
            <FieldError messages={fe?.checkIn} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Saída")}</span>
            <input type="date" className="field" value={checkOut} min={addDays(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} />
            <FieldError messages={fe?.checkOut} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Adultos")}</span>
            <input type="number" min={1} max={20} className="field" value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Crianças")}</span>
            <input type="number" min={0} max={20} className="field" value={children} onChange={(e) => setChildren(Number(e.target.value))} />
          </label>
        </div>
        {validDates && (
          <p className="text-sm text-zinc-600">{tr("{0} {1}: {2} a {3}", [nights, nights === 1 ? tr("noite") : tr("noites"), formatDate(checkIn), formatDate(checkOut)])}</p>
        )}

        <div>
          <div className="mb-1 text-xs text-zinc-500">{tr("Tipo de quarto — livres em todas as noites")}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(avail ?? types.map((t) => ({ roomTypeId: t.id, name: t.name, capacity: t.capacity, free: NaN, total: 0, byNight: [] }))).map((a) => {
              const selected = roomTypeId === a.roomTypeId;
              const none = a.free < 1;
              return (
                <button
                  key={a.roomTypeId}
                  type="button"
                  disabled={inHouse}
                  onClick={() => {
                    setRoomTypeId(a.roomTypeId);
                    applyPlan(ratePlanId, a.roomTypeId);
                    if (roomId && rooms?.find((r) => r.id === roomId)?.roomTypeId !== a.roomTypeId) setRoomId("");
                  }}
                  className={`rounded-lg border-2 p-3 text-left transition ${
                    selected ? "border-blue-600 bg-blue-50" : "border-zinc-200 hover:border-zinc-400"
                  } ${none && !selected ? "opacity-50" : ""} disabled:cursor-not-allowed`}
                >
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-xs text-zinc-500">{tr("até {0} pessoas", [a.capacity])}</div>
                  <div className={`mt-1 text-sm font-bold ${Number.isNaN(a.free) ? "text-zinc-400" : none ? "text-red-600" : "text-emerald-700"}`}>
                    {Number.isNaN(a.free) ? "…" : none ? tr("Esgotado") : tr("{0} livre{1}", [a.free, a.free > 1 ? tr("s") : ""])}
                  </div>
                </button>
              );
            })}
          </div>
          <FieldError messages={fe?.roomTypeId} />
          {typeCapacity !== undefined && adults + children > typeCapacity && (
            <p className="mt-1 text-xs text-amber-700">{tr("Atenção: {0} pessoas para um quarto de até {1}.", [adults + children, typeCapacity])}</p>
          )}
        </div>

        {!inHouse && (
          <div>
            <label className="block">
              <span className="text-xs text-zinc-500">{tr("Quarto {0}", [mode === "direto" ? tr("* (só aparecem quartos limpos e livres)") : tr("(opcional — pode escolher depois)")])}</span>
              <select
                className="field"
                value={roomId}
                required={mode === "direto"}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  // Escolher o quarto já define o tipo e a diária.
                  const room = rooms?.find((r) => r.id === e.target.value);
                  if (room && room.roomTypeId !== roomTypeId) {
                    setRoomTypeId(room.roomTypeId);
                    applyPlan(ratePlanId, room.roomTypeId);
                  }
                }}
              >
                <option value="">{mode === "direto" ? tr("Escolha o quarto") : tr("Escolher depois")}</option>
                {roomChoices.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} — {r.typeName}{r.problem ? tr(" (⚠ tem problema aberto)") : ""}
                  </option>
                ))}
              </select>
            </label>
            <FieldError messages={fe?.roomId} />
            <label className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
              <input type="checkbox" checked={showOtherTypes} onChange={(e) => setShowOtherTypes(e.target.checked)} />{tr("mostrar quartos de outros tipos (upgrade)")}</label>
            {rooms && roomChoices.length === 0 && roomTypeId && (
              <p className="text-xs text-amber-700">{tr("Nenhum quarto deste tipo {0}.", [mode === "direto" ? tr("limpo e livre agora") : tr("livre nessas datas")])}</p>
            )}
          </div>
        )}
      </section>

      {/* VALORES */}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">{mode === "editar" ? tr("Valores e origem") : tr("3. Valores e origem")}</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className="text-xs text-zinc-500">{tr("Tarifa")}</span>
            <select
              className="field"
              value={ratePlanId}
              onChange={(e) => {
                setRatePlanId(e.target.value);
                applyPlan(e.target.value, roomTypeId);
              }}
            >
              <option value="">{tr("Sem tarifa (valor manual)")}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Diária (R$)")}</span>
            <input className="field" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="0,00" required />
            <FieldError messages={fe?.daily} />
          </label>
          <label className="flex items-center gap-2 pt-5 text-sm">
            <input type="checkbox" checked={breakfast} onChange={(e) => setBreakfast(e.target.checked)} />{" "}{tr("Café da manhã")}</label>
          <div className="flex items-center gap-2 pt-5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={chargeIss} onChange={(e) => setChargeIss(e.target.checked)} />{" "}{tr("ISS")}</label>
            <input className="field w-16" inputMode="decimal" value={issPercent} disabled={!chargeIss} onChange={(e) => setIssPercent(e.target.value)} aria-label={tr("Alíquota do ISS")} />%
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="text-xs text-zinc-500">{tr("Origem")}</span>
            <select className="field" value={source} onChange={(e) => setSource(e.target.value as Source)}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{tr(SOURCE_LABEL[s])}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Nº no portal (se houver)")}</span>
            <input name="externalCode" className="field" defaultValue={initial.externalCode ?? ""} maxLength={40} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Observações")}</span>
            <input name="notes" className="field" defaultValue={initial.notes ?? ""} maxLength={1000} placeholder={tr("Ex.: chega tarde, cama extra")} />
          </label>
        </div>

        {totals && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-zinc-50 p-3 text-sm">
            <span>{totals.nights}{" "}{tr("× {0} =", [formatBRL(dailyCents!)])}{" "}<b>{formatBRL(totals.lodging)}</b></span>
            {chargeIss && <span>{tr("ISS ({0}%):", [issPercent])}{" "}<b>{formatBRL(totals.iss)}</b></span>}
            <span className="text-base">{tr("Total previsto:")}{" "}<b>{formatBRL(totals.total)}</b></span>
          </div>
        )}
      </section>

      {mode === "direto" && (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">{tr("4. Veículo na garagem (opcional)")}</h2>
          <VehicleFields errors={fe} />
        </section>
      )}

      <FormMessage error={errors.error} />
      {missing.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{tr("Para continuar: {0}.", [missing.join(" · ")])}</p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary px-6 py-3" disabled={pending || missing.length > 0}>
          {pending ? tr("Salvando...") : mode === "direto" ? tr("Fazer check-in") : mode === "editar" ? tr("Salvar alterações") : tr("Confirmar reserva")}
        </button>
        {mode === "editar" && (
          <button type="button" className="btn-secondary" onClick={onDone}>{tr("Cancelar")}</button>
        )}
      </div>
    </form>
  );
}

function GuestSearch({ onPick, onNew }: { onPick: (g: GuestView) => void; onNew: () => void }) {
  const tr = useT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<(GuestView & { stays: number })[] | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let alive = true;
    const t = setTimeout(() => searchGuestsAction(q).then((r) => alive && setResults(r)), 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const shown = q.trim().length >= 2 ? results : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          className="field max-w-md flex-1"
          placeholder={tr("Buscar por nome, CPF ou telefone...")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <button type="button" className="btn-secondary" onClick={onNew}>{tr("+ Novo hóspede")}</button>
      </div>
      {shown && (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {shown.map((g) => (
            <li key={g.id}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-blue-50" onClick={() => onPick(g)}>
                <span className="font-medium">{g.fullName}</span>{" "}
                <span className="text-xs text-zinc-500">
                  {[g.docNumber, g.phone].filter(Boolean).join(" · ")} · {g.stays} {g.stays === 1 ? tr("estadia") : tr("estadias")}
                </span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">{tr("Ninguém encontrado. Use “+ Novo hóspede”.")}</li>}
        </ul>
      )}
    </div>
  );
}
