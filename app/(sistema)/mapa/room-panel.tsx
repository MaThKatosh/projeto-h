"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { can, type Role } from "@/lib/permissions";
import type { RoomView } from "@/lib/rooms/service";
import { blockReason, canChangeStatus, cleaningBlockedReason, type StatusChange } from "@/lib/rooms/rules";
import { STATUS_LABEL } from "@/lib/maintenance/rules";
import {
  badges,
  DISPLAY,
  displayStatus,
  HOUSEKEEPING_LABEL,
  MAINTENANCE_LABEL,
  OCCUPANCY_LABEL,
  type Housekeeping,
  type Maintenance,
} from "@/lib/rooms/status";
import { dateTime } from "@/components/time";
import { PriorityChip } from "../manutencao/board";
import { NewTicketForm } from "../manutencao/new-ticket-form";
import { changeStatusAction, roomDetailsAction, type RoomDetails } from "./actions";
import { formatDate } from "@/lib/dates";
import type { Occupant } from "./room-map";

import { useT } from "@/components/i18n";
const HOUSEKEEPING_OPTIONS: { value: Housekeeping; color: string }[] = [
  { value: "LIMPO", color: "bg-emerald-500" },
  { value: "SUJO", color: "bg-amber-300" },
  { value: "EM_ARRUMACAO", color: "bg-orange-500" },
];

const FIELD_LABEL: Record<string, string> = {
  housekeeping: "Limpeza",
  maintenance: "Manutenção",
  occupancy: "Ocupação",
  note: "Observação",
};

const CLEANING_LABEL: Record<string, string> = { PENDENTE: "esperando arrumação", EM_ANDAMENTO: "sendo arrumado" };

function valueLabel(field: string, value: string | null) {
  if (value === null) return "—";
  if (field === "housekeeping") return HOUSEKEEPING_LABEL[value as Housekeeping] ?? value;
  if (field === "maintenance") return MAINTENANCE_LABEL[value as Maintenance] ?? value;
  if (field === "occupancy") return OCCUPANCY_LABEL[value as keyof typeof OCCUPANCY_LABEL] ?? value;
  return `“${value}”`;
}

export function RoomPanel({
  room,
  role,
  occupant,
  canSeeReservations,
  onClose,
  onUpdated,
}: {
  room: RoomView;
  role: Role;
  occupant?: Occupant;
  canSeeReservations: boolean;
  onClose: () => void;
  onUpdated: (room: RoomView) => void;
}) {
  const tr = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [note, setNote] = useState(room.note ?? "");
  const [reporting, setReporting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const status = displayStatus(room);

  // Recarrega os detalhes quando o quarto muda (inclusive por outra pessoa).
  useEffect(() => {
    let alive = true;
    roomDetailsAction(room.id).then((d) => alive && setDetails(d));
    return () => {
      alive = false;
    };
  }, [room.id, room.updatedAt, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function apply(change: StatusChange) {
    setError(null);
    startTransition(async () => {
      const result = await changeStatusAction(room.id, change);
      if (result.ok) onUpdated(result.room);
      else setError(result.error);
    });
  }

  const allowed = (change: StatusChange) => canChangeStatus(role, room, change) && !blockReason(room, change);
  const canNote = canChangeStatus(role, room, { field: "note", value: "" });
  const cleaningBlocked = cleaningBlockedReason(room.maintenance);
  const canBlock = canChangeStatus(role, room, { field: "maintenance", value: "BLOQUEADO" });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/30 md:items-stretch" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr("Quarto {0}", [room.number])}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl md:max-h-none md:w-[26rem] md:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-start justify-between p-5 ${DISPLAY[status].card}`}>
          <div>
            <div className="text-3xl font-black">{tr("Quarto")}{" "}{room.number}</div>
            <div className="text-sm opacity-90">
              {room.typeName} · {room.floor === 0 ? tr("Térreo") : tr("{0}º andar", [room.floor])}
            </div>
            <div className="mt-2 text-lg font-semibold">
              {tr(DISPLAY[status].icon)} {tr(DISPLAY[status].label)}
            </div>
            {badges(room).length > 0 && <div className="text-sm">{badges(room).map((b) => tr(b)).join(" · ")}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label={tr("Fechar")} className="rounded-lg px-2 py-1 text-xl hover:bg-black/10">
            ✕
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Info label={tr("Ocupação")} value={OCCUPANCY_LABEL[room.occupancy]} />
            <Info label={tr("Limpeza")} value={HOUSEKEEPING_LABEL[room.housekeeping]} />
            <Info label={tr("Manutenção")} value={MAINTENANCE_LABEL[room.maintenance]} />
          </div>

          {occupant && (
            <div className={`rounded-xl p-3 text-sm ${occupant.arriving ? "bg-sky-50" : "bg-blue-50"}`}>
              <div className="text-xs text-zinc-500">{occupant.arriving ? tr("Chega hoje") : tr("Hospedado")}</div>
              <div className="text-base font-semibold">{occupant.guestName}</div>
              <div className="text-xs text-zinc-600">
                {occupant.arriving ? tr("reserva com este quarto") : tr("saída {0}", [formatDate(occupant.checkOut)])}
              </div>
              {canSeeReservations && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={`/reservas/${occupant.reservationId}`} className="btn-secondary px-3 py-1.5 text-xs">{tr("Abrir reserva")}</Link>
                  {can(role, "reservations.manage") && (
                    <Link
                      href={`/reservas/${occupant.reservationId}?acao=${occupant.arriving ? "checkin" : "checkout"}`}
                      className="btn bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                    >
                      {occupant.arriving ? tr("Fazer check-in") : tr("Fazer check-out")}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{tr(error)}</p>}

          {/* LIMPEZA */}
          <div>
            <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">{tr("Limpeza (governança)")}{can(role, "housekeeping.view") && (
                <Link href="/governanca" className="text-xs font-normal text-blue-700 underline">{tr("painel da governança")}</Link>
              )}
            </h3>
            {details?.cleaning && (
              <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {details.cleaning.priority && <b>{tr("★ Prioridade ·")}{" "}</b>}{tr("Quarto {0} · responsável:", [tr(CLEANING_LABEL[details.cleaning.status]) ?? ""])}{" "}<b>{details.cleaning.assignedToName ?? tr("ninguém")}</b>
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {HOUSEKEEPING_OPTIONS.map((o) => (
                <Choice
                  key={o.value}
                  label={tr(HOUSEKEEPING_LABEL[o.value])}
                  color={o.color}
                  current={room.housekeeping === o.value}
                  disabled={
                    pending ||
                    !allowed({ field: "housekeeping", value: o.value }) ||
                    (o.value !== "SUJO" && cleaningBlocked !== null)
                  }
                  onClick={() => apply({ field: "housekeeping", value: o.value })}
                />
              ))}
            </div>
            {cleaningBlocked && <p className="mt-1 text-xs text-zinc-500">{cleaningBlocked}</p>}
          </div>

          {/* MANUTENÇÃO */}
          <div>
            <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">{tr("Manutenção")}{can(role, "maintenance.view") && (
                <Link href="/manutencao" className="text-xs font-normal text-blue-700 underline">{tr("painel da manutenção")}</Link>
              )}
            </h3>
            {details === null ? (
              <p className="text-sm text-zinc-400">{tr("Carregando...")}</p>
            ) : details.tickets.length === 0 ? (
              <p className="text-sm text-zinc-500">{tr("Nenhum problema aberto.")}</p>
            ) : (
              <ul className="space-y-2">
                {details.tickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/manutencao?id=${t.id}`}
                      className="block rounded-lg border border-zinc-200 p-2 text-sm hover:border-zinc-400"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{tr("nº {0} ·", [t.number])}{" "}{t.title}</span>
                        <PriorityChip priority={t.priority} />
                      </div>
                      <div className="text-xs text-zinc-500">
                        {tr(STATUS_LABEL[t.status])} · {t.assignedToName ?? tr("sem responsável")}
                        {t.outOfOrder && <b className="text-red-700">{" "}{tr("· 🚫 fora de venda")}</b>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              {can(role, "rooms.reportProblem") && !reporting && (
                <button type="button" className="btn-secondary" onClick={() => setReporting(true)}>{tr("⚠ Avisar problema")}</button>
              )}
              {canBlock && room.maintenance !== "BLOQUEADO" && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={pending || !allowed({ field: "maintenance", value: "BLOQUEADO" })}
                  title={blockReason(room, { field: "maintenance", value: "BLOQUEADO" }) ?? tr("Tira o quarto de uso (ex.: reforma)")}
                  onClick={() => apply({ field: "maintenance", value: "BLOQUEADO" })}
                >{tr("⛔ Bloquear quarto")}</button>
              )}
              {canBlock && room.maintenance === "BLOQUEADO" && (
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => apply({ field: "maintenance", value: "OK" })}>{tr("Desbloquear")}</button>
              )}
            </div>
            {room.occupancy === "OCUPADO" && canBlock && room.maintenance !== "BLOQUEADO" && (
              <p className="mt-1 text-xs text-zinc-500">{tr("Quarto ocupado não pode ser bloqueado.")}</p>
            )}

            {reporting && (
              <div className="mt-3 rounded-xl border border-zinc-200 p-3">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold">{tr("Avisar problema no quarto {0}", [room.number])}<button type="button" className="text-xs text-zinc-500 underline" onClick={() => setReporting(false)}>{tr("fechar")}</button>
                </div>
                <NewTicketForm
                  fixedRoom={{ id: room.id, number: room.number }}
                  onDone={() => {
                    setReporting(false);
                    setRefresh((n) => n + 1);
                  }}
                />
              </div>
            )}
          </div>

          {/* OBSERVAÇÃO */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">{tr("Observação")}</h3>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                apply({ field: "note", value: note });
              }}
            >
              <input
                className="field"
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder={canNote ? tr("Ex.: hóspede pediu travesseiro extra") : tr("Sem observação")}
                disabled={!canNote}
              />
              <button type="submit" className="btn-secondary" disabled={!canNote || pending || note === (room.note ?? "")}>{tr("Salvar")}</button>
            </form>
          </div>

          {/* HISTÓRICO */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">{tr("Últimas mudanças")}</h3>
            {details === null ? (
              <p className="text-sm text-zinc-400">{tr("Carregando...")}</p>
            ) : details.history.length === 0 ? (
              <p className="text-sm text-zinc-400">{tr("Nenhuma mudança registrada.")}</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {details.history.map((h) => (
                  <li key={h.id} className="border-l-2 border-zinc-200 pl-3">
                    <div>
                      <b>{tr(FIELD_LABEL[h.field]) ?? h.field}:</b> {valueLabel(h.field, h.fromValue)} → {valueLabel(h.field, h.toValue)}
                    </div>
                    <div className="text-xs text-zinc-500">{h.userName} · {dateTime(h.createdAt)}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const tr = useT();
  return (
    <div className="rounded-lg bg-zinc-100 px-2 py-2">
      <div className="text-zinc-500">{tr(label)}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Choice({
  label,
  color,
  current,
  disabled,
  onClick,
}: {
  label: string;
  color: string;
  current: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const tr = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || current}
      aria-pressed={current}
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm font-medium transition ${
        current ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:border-zinc-400 disabled:opacity-40"
      } disabled:cursor-not-allowed`}
    >
      <span className={`h-3 w-3 shrink-0 rounded-full ${color}`} />
      {tr(label)}
    </button>
  );
}
