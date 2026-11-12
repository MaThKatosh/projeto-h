"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormMessage } from "@/components/field-error";
import { LiveRefresher } from "@/components/live-refresher";
import { dateTime } from "@/components/time";
import type { FieldErrors } from "@/lib/auth/validation";
import type { RatePlanView } from "@/lib/rates/service";
import type { ReservationDetail } from "@/lib/reservations/service";
import { formatDate, nightsBetween, weekday, type DateStr } from "@/lib/dates";
import { formatBRL, formatPercent } from "@/lib/money";
import { SOURCE_LABEL, STATUS } from "@/lib/reservations/rules";
import { GuestFields, readGuest, readVehicle, VehicleFields } from "../guest-fields";
import { StayForm } from "../stay-form";
import {
  addCompanionAction,
  addVehicleAction,
  assignRoomAction,
  cancelAction,
  checkInAction,
  checkOutAction,
  freeRoomsAction,
  moveRoomAction,
  readyRoomsAction,
  removeCompanionAction,
  updateGuestAction,
  vehicleExitAction,
  type ActionResult,
} from "../actions";

type Panel = null | "checkin" | "checkout" | "editar" | "trocar" | "cancelar" | "noshow" | "quarto" | "hospede" | "acompanhante" | "veiculo";

const EVENT_LABEL: Record<string, string> = {
  criada: "Reserva criada",
  alterada: "Alterada",
  quarto: "Quarto",
  checkin: "Check-in",
  checkout: "Check-out",
  troca_quarto: "Troca de quarto",
  cancelada: "Cancelada",
  no_show: "Não compareceu",
  acompanhante: "Acompanhante incluído",
  acompanhante_removido: "Acompanhante removido",
  veiculo: "Garagem",
};

export function ReservationView({
  r,
  today,
  plans,
  types,
  canManage,
  initialAction,
}: {
  r: ReservationDetail;
  today: DateStr;
  plans: RatePlanView[];
  types: { id: string; name: string; capacity: number }[];
  canManage: boolean;
  initialAction: "checkin" | "checkout" | null;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(canManage ? initialAction : null);
  const [message, setMessage] = useState<string | null>(null);
  const confirmed = r.status === "CONFIRMADA";
  const inHouse = r.status === "HOSPEDADA";
  const late = confirmed && r.checkIn < today;
  const leavingToday = inHouse && r.checkOut <= today;

  const done = (text: string) => {
    setPanel(null);
    setMessage(text);
    router.refresh();
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/reservas" className="text-sm text-blue-700 underline">← Reservas</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold">
            Reserva nº {r.number}
            <span className={`rounded px-2 py-0.5 text-sm font-semibold ${STATUS[r.status].chip}`}>{STATUS[r.status].label}</span>
            {late && <span className="rounded bg-red-600 px-2 py-0.5 text-sm text-white">atrasada</span>}
            {leavingToday && <span className="rounded bg-amber-500 px-2 py-0.5 text-sm text-white">sai hoje</span>}
          </h1>
          <LiveRefresher types={["reservations.changed"]} />
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {confirmed && (
              <>
                <button className="btn bg-emerald-600 px-5 py-3 text-white hover:bg-emerald-700" onClick={() => setPanel("checkin")}>🛎 Fazer check-in</button>
                <button className="btn-secondary" onClick={() => setPanel("quarto")}>Escolher quarto</button>
                <button className="btn-secondary" onClick={() => setPanel("editar")}>Alterar</button>
                {r.checkIn <= today && <button className="btn-secondary" onClick={() => setPanel("noshow")}>Não compareceu</button>}
                <button className="btn-secondary text-red-700" onClick={() => setPanel("cancelar")}>Cancelar</button>
              </>
            )}
            {inHouse && (
              <>
                <button className="btn bg-blue-600 px-5 py-3 text-white hover:bg-blue-700" onClick={() => setPanel("checkout")}>🧳 Fazer check-out</button>
                <button className="btn-secondary" onClick={() => setPanel("trocar")}>⇄ Trocar quarto</button>
                <button className="btn-secondary" onClick={() => setPanel("editar")}>Alterar saída / valores</button>
                <button className="btn-secondary" onClick={() => setPanel("veiculo")}>🚗 Veículo</button>
              </>
            )}
          </div>
        )}
      </div>

      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ {message} <button className="ml-2 underline" onClick={() => setMessage(null)}>ok</button>
        </p>
      )}

      {panel === "checkin" && <CheckInPanel r={r} today={today} onClose={() => setPanel(null)} onDone={done} />}
      {panel === "checkout" && <CheckOutPanel r={r} today={today} onClose={() => setPanel(null)} onDone={done} />}
      {panel === "trocar" && <MovePanel r={r} today={today} onClose={() => setPanel(null)} onDone={done} />}
      {panel === "quarto" && <AssignPanel r={r} onClose={() => setPanel(null)} onDone={done} />}
      {(panel === "cancelar" || panel === "noshow") && <CancelPanel r={r} noShow={panel === "noshow"} onClose={() => setPanel(null)} onDone={done} />}
      {panel === "veiculo" && <VehiclePanel r={r} onClose={() => setPanel(null)} onDone={done} />}
      {panel === "editar" && (
        <Box title="Alterar reserva" onClose={() => setPanel(null)}>
          <StayForm
            mode="editar"
            reservationId={r.id}
            inHouse={inHouse}
            today={today}
            plans={plans}
            types={types}
            initial={{
              checkIn: r.checkIn,
              checkOut: r.checkOut,
              adults: r.adults,
              children: r.children,
              roomTypeId: r.roomTypeId,
              ratePlanId: r.ratePlanId,
              dailyCents: r.dailyCents,
              breakfast: r.breakfast,
              chargeIss: r.chargeIss,
              issBasisPoints: r.issBasisPoints,
              source: r.source,
              externalCode: r.externalCode,
              notes: r.notes,
              roomId: r.roomId,
            }}
            onDone={() => done("Reserva alterada.")}
          />
        </Box>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Big label="Entrada" value={`${formatDate(r.checkIn)} ${weekday(r.checkIn)}`} />
            <Big label="Saída" value={`${formatDate(r.checkOut)} ${weekday(r.checkOut)}`} />
            <Big label="Quarto" value={r.roomNumber ?? "a definir"} hint={r.roomTypeName} />
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Item k="Noites" v={String(nightsBetween(r.checkIn, r.checkOut))} />
            <Item k="Pessoas" v={`${r.adults} adulto(s)${r.children ? ` + ${r.children} criança(s)` : ""}`} />
            <Item k="Origem" v={`${SOURCE_LABEL[r.source]}${r.externalCode ? ` · nº ${r.externalCode}` : ""}`} />
            <Item k="Tarifa" v={r.ratePlanName ?? "valor manual"} />
            <Item k="Café da manhã" v={r.breakfast ? "incluído" : "não incluído"} />
            <Item k="Criada por" v={`${r.createdByName ?? "Sistema"} em ${dateTime(r.createdAt)}`} />
            {r.checkedInAt && <Item k="Check-in" v={dateTime(r.checkedInAt)} />}
            {r.checkedOutAt && <Item k="Check-out" v={dateTime(r.checkedOutAt)} />}
            {r.cancelReason && <Item k="Motivo" v={r.cancelReason} />}
          </dl>
          {r.notes && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm">📝 {r.notes}</p>}
        </section>

        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Valores previstos</h2>
          <dl className="space-y-1 text-sm">
            <Item k={`${r.totals.nights} × diária`} v={`${formatBRL(r.dailyCents)} = ${formatBRL(r.totals.lodging)}`} />
            {r.chargeIss && <Item k={`ISS ${formatPercent(r.issBasisPoints)}`} v={formatBRL(r.totals.iss)} />}
            <div className="mt-2 border-t border-zinc-200 pt-2 text-lg font-bold">{formatBRL(r.totals.total)}</div>
          </dl>
          <p className="mt-2 text-xs text-zinc-500">A conta do quarto (consumos e pagamentos) chega na Fase 4.</p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Hóspede titular</h2>
            {canManage && panel !== "hospede" && <button className="text-sm text-blue-700 underline" onClick={() => setPanel("hospede")}>editar</button>}
          </div>
          {panel === "hospede" ? (
            <GuestEdit r={r} onClose={() => setPanel(null)} onDone={done} />
          ) : (
            <div className="text-sm">
              <div className="text-lg font-semibold">{r.guest.fullName}</div>
              <div className="text-zinc-600">
                {[r.guest.docType && r.guest.docNumber ? `${r.guest.docType} ${r.guest.docNumber}` : "sem documento", r.guest.phone, r.guest.email].filter(Boolean).join(" · ")}
              </div>
              {(r.guest.city || r.guest.state) && <div className="text-zinc-500">{[r.guest.city, r.guest.state].filter(Boolean).join(" / ")}</div>}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Acompanhantes ({r.companions.length})</h3>
            {canManage && (confirmed || inHouse) && panel !== "acompanhante" && (
              <button className="text-sm text-blue-700 underline" onClick={() => setPanel("acompanhante")}>+ incluir</button>
            )}
          </div>
          {panel === "acompanhante" && <CompanionAdd r={r} onClose={() => setPanel(null)} onDone={done} />}
          <ul className="mt-2 space-y-1 text-sm">
            {r.companions.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1">
                <span>{c.fullName} <span className="text-xs text-zinc-500">{c.docNumber ?? ""}</span></span>
                {canManage && (confirmed || inHouse) && <RemoveCompanion reservationId={r.id} guestId={c.id} onDone={done} />}
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Veículos</h2>
          {r.vehicleList.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum veículo.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {r.vehicleList.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1">
                  <span>
                    <b>{v.plate}</b> {[v.model, v.color].filter(Boolean).join(" ")} {v.spot && `· vaga ${v.spot}`}
                    <span className="block text-xs text-zinc-500">
                      entrou {dateTime(v.enteredAt)}{v.exitedAt ? ` · saiu ${dateTime(v.exitedAt)}` : " · na garagem"}
                    </span>
                  </span>
                  {canManage && !v.exitedAt && <VehicleExit vehicleId={v.id} onDone={done} />}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-5 mb-2 font-semibold">Histórico</h2>
          <ol className="space-y-2 text-sm">
            {r.events.map((e) => (
              <li key={e.id} className="border-l-2 border-zinc-200 pl-3">
                <b>{EVENT_LABEL[e.type] ?? e.type}</b>
                {e.message && <span className="text-zinc-700"> — {e.message}</span>}
                <div className="text-xs text-zinc-500">{e.userName} · {dateTime(e.createdAt)}</div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// PAINÉIS DE AÇÃO
// ----------------------------------------------------------------

type PanelProps = { r: ReservationDetail; onClose: () => void; onDone: (msg: string) => void };

function useAction() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; fieldErrors?: FieldErrors }>({});
  const run = (fn: () => Promise<ActionResult>, onOk: () => void) =>
    start(async () => {
      setState({});
      const res = await fn();
      if (res.ok) onOk();
      else setState({ error: res.error, fieldErrors: res.fieldErrors });
    });
  return { pending, state, run };
}

type RoomOpt = { id: string; number: string; roomTypeId: string; typeName: string; problem?: boolean };

function useRooms(loader: () => Promise<RoomOpt[]>) {
  const [rooms, setRooms] = useState<RoomOpt[] | null>(null);
  const loaderRef = useRef(loader);
  useEffect(() => {
    let alive = true;
    loaderRef.current().then((x) => alive && setRooms(x));
    return () => {
      alive = false;
    };
  }, []);
  return rooms;
}

function RoomPicker({ rooms, value, onChange, typeId }: { rooms: RoomOpt[] | null; value: string; onChange: (id: string) => void; typeId: string }) {
  const [others, setOthers] = useState(false);
  if (!rooms) return <p className="text-sm text-zinc-400">Buscando quartos...</p>;
  const list = rooms.filter((x) => others || x.roomTypeId === typeId);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {list.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => onChange(room.id)}
            className={`rounded-xl border-2 px-3 py-2 text-left ${value === room.id ? "border-blue-600 bg-blue-50" : "border-emerald-300 bg-emerald-50 hover:border-emerald-500"}`}
          >
            <div className="text-lg leading-none font-black">{room.number}</div>
            <div className="text-[10px] text-zinc-600">{room.typeName}{room.problem ? " · ⚠" : ""}</div>
          </button>
        ))}
        {list.length === 0 && <p className="text-sm text-amber-700">Nenhum quarto disponível deste tipo.</p>}
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-600">
        <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} /> mostrar outros tipos (upgrade)
      </label>
    </div>
  );
}

function CheckInPanel({ r, today, onClose, onDone }: PanelProps & { today: DateStr }) {
  const rooms = useRooms(() => readyRoomsAction(today < r.checkIn ? r.checkIn : today, r.checkOut, r.id));
  const [roomId, setRoomId] = useState(r.roomId ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, state, run } = useAction();
  const assignedNotReady = rooms && r.roomId && !rooms.some((x) => x.id === r.roomId);
  const effectiveRoom = assignedNotReady && roomId === r.roomId ? "" : roomId;

  return (
    <Box title={`Check-in — ${r.guest.fullName}`} onClose={onClose}>
      <form
        ref={formRef}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = formRef.current!;
          run(
            () => checkInAction(r.id, { roomId: effectiveRoom, guest: readGuest(form), vehicle: readVehicle(form) }),
            () => onDone("Check-in feito. Bem-vindo!")
          );
        }}
      >
        {r.checkIn > today && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">A reserva é para {formatDate(r.checkIn)}. Altere a entrada para hoje antes do check-in.</p>
        )}
        <div>
          <h3 className="mb-2 text-sm font-semibold">1. Quarto (só limpos e livres)</h3>
          {assignedNotReady && (
            <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
              O quarto reservado ({r.roomNumber}) ainda não está pronto. Escolha outro ou peça prioridade à governança.
            </p>
          )}
          <RoomPicker rooms={rooms} value={effectiveRoom} onChange={setRoomId} typeId={r.roomTypeId} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">2. Confira a ficha do hóspede</h3>
          <GuestFields initial={r.guest} errors={state.fieldErrors} requireDoc />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">3. Veículo (opcional)</h3>
          <VehicleFields errors={state.fieldErrors} />
        </div>
        <FormMessage error={state.error} />
        <button type="submit" className="btn bg-emerald-600 px-6 py-3 text-white hover:bg-emerald-700" disabled={pending || !effectiveRoom}>
          {pending ? "Fazendo check-in..." : "Confirmar check-in"}
        </button>
      </form>
    </Box>
  );
}

function CheckOutPanel({ r, today, onClose, onDone }: PanelProps & { today: DateStr }) {
  const { pending, state, run } = useAction();
  const early = r.checkOut > today;
  const cars = r.vehicleList.filter((v) => !v.exitedAt);
  return (
    <Box title={`Check-out — quarto ${r.roomNumber}`} onClose={onClose}>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">
        {early && <li className="text-amber-700">Saída antecipada: a reserva era até {formatDate(r.checkOut)}. As noites não usadas serão liberadas.</li>}
        <li>O quarto {r.roomNumber} fica livre e vai para a governança como <b>sujo</b>.</li>
        {cars.length > 0 && <li>Saída na garagem: {cars.map((v) => v.plate).join(", ")}.</li>}
        <li className="text-zinc-500">A conferência da conta (consumos e pagamentos) entra na Fase 4.</li>
      </ul>
      <FormMessage error={state.error} />
      <button className="btn bg-blue-600 px-6 py-3 text-white hover:bg-blue-700" disabled={pending} onClick={() => run(() => checkOutAction(r.id), () => onDone("Check-out feito. Quarto enviado para a governança."))}>
        {pending ? "Fazendo check-out..." : "Confirmar check-out"}
      </button>
    </Box>
  );
}

function MovePanel({ r, today, onClose, onDone }: PanelProps & { today: DateStr }) {
  const rooms = useRooms(() => readyRoomsAction(today, r.checkOut, r.id));
  const [roomId, setRoomId] = useState("");
  const [reason, setReason] = useState("");
  const { pending, state, run } = useAction();
  return (
    <Box title={`Trocar quarto — hoje no ${r.roomNumber}`} onClose={onClose}>
      <div className="space-y-3">
        <RoomPicker rooms={rooms} value={roomId} onChange={setRoomId} typeId={r.roomTypeId} />
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (ex.: ar-condicionado com defeito, pedido do hóspede)" maxLength={300} />
        <p className="text-xs text-zinc-500">O quarto {r.roomNumber} fica livre e vai para a governança como sujo. A diária combinada continua a mesma.</p>
        <FormMessage error={state.error} />
        <button className="btn-primary" disabled={pending || !roomId || reason.trim().length < 3} onClick={() => run(() => moveRoomAction(r.id, roomId, reason), () => onDone("Troca de quarto feita."))}>
          {pending ? "Trocando..." : "Confirmar troca"}
        </button>
      </div>
    </Box>
  );
}

function AssignPanel({ r, onClose, onDone }: PanelProps) {
  const rooms = useRooms(() => freeRoomsAction(r.checkIn, r.checkOut, r.id));
  const [roomId, setRoomId] = useState(r.roomId ?? "");
  const { pending, state, run } = useAction();
  return (
    <Box title="Escolher quarto da reserva" onClose={onClose}>
      <p className="mb-2 text-xs text-zinc-500">Quartos sem outra reserva de {formatDate(r.checkIn)} a {formatDate(r.checkOut)} (não precisam estar limpos agora).</p>
      <RoomPicker rooms={rooms} value={roomId} onChange={setRoomId} typeId={r.roomTypeId} />
      <FormMessage error={state.error} />
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" disabled={pending || !roomId || roomId === r.roomId} onClick={() => run(() => assignRoomAction(r.id, roomId), () => onDone("Quarto definido."))}>Salvar quarto</button>
        {r.roomId && (
          <button className="btn-secondary" disabled={pending} onClick={() => run(() => assignRoomAction(r.id, null), () => onDone("Quarto liberado."))}>Deixar sem quarto</button>
        )}
      </div>
    </Box>
  );
}

function CancelPanel({ r, noShow, onClose, onDone }: PanelProps & { noShow: boolean }) {
  const [reason, setReason] = useState(noShow ? "Hóspede não compareceu" : "");
  const { pending, state, run } = useAction();
  return (
    <Box title={noShow ? "Marcar como não compareceu (no-show)" : "Cancelar reserva"} onClose={onClose}>
      <div className="space-y-3">
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" maxLength={300} />
        <FormMessage error={state.error} />
        <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={pending} onClick={() => run(() => cancelAction(r.id, reason, noShow), () => onDone(noShow ? "Marcada como não compareceu." : "Reserva cancelada."))}>
          Confirmar
        </button>
      </div>
    </Box>
  );
}

function VehiclePanel({ r, onClose, onDone }: PanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, state, run } = useAction();
  return (
    <Box title="Registrar veículo na garagem" onClose={onClose}>
      <form
        ref={formRef}
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const v = readVehicle(formRef.current!) ?? { plate: "" };
          run(() => addVehicleAction(r.id, v), () => onDone("Veículo registrado."));
        }}
      >
        <VehicleFields errors={state.fieldErrors} />
        <FormMessage error={state.fieldErrors ? undefined : state.error} />
        <button className="btn-primary" disabled={pending}>Registrar entrada</button>
      </form>
    </Box>
  );
}

function GuestEdit({ r, onClose, onDone }: PanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, state, run } = useAction();
  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateGuestAction(r.guest.id, readGuest(formRef.current!)), () => onDone("Dados do hóspede salvos."));
      }}
    >
      <GuestFields initial={r.guest} errors={state.fieldErrors} />
      <FormMessage error={state.fieldErrors ? undefined : state.error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>Salvar</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
      </div>
    </form>
  );
}

function CompanionAdd({ r, onClose, onDone }: PanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, state, run } = useAction();
  return (
    <form
      ref={formRef}
      className="mt-2 space-y-3 rounded-lg border border-zinc-200 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addCompanionAction(r.id, readGuest(formRef.current!, "c_")), () => onDone("Acompanhante incluído."));
      }}
    >
      <GuestFields prefix="c_" errors={state.fieldErrors} compact />
      <FormMessage error={state.fieldErrors ? undefined : state.error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>Incluir</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
      </div>
    </form>
  );
}

function RemoveCompanion({ reservationId, guestId, onDone }: { reservationId: string; guestId: string; onDone: (m: string) => void }) {
  const { pending, run } = useAction();
  return (
    <button className="text-xs text-red-700 underline" disabled={pending} onClick={() => run(() => removeCompanionAction(reservationId, guestId), () => onDone("Acompanhante removido."))}>
      remover
    </button>
  );
}

function VehicleExit({ vehicleId, onDone }: { vehicleId: string; onDone: (m: string) => void }) {
  const { pending, run } = useAction();
  return (
    <button className="btn-secondary px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => vehicleExitAction(vehicleId), () => onDone("Saída do veículo registrada."))}>
      registrar saída
    </button>
  );
}

// ----------------------------------------------------------------

function Box({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <section className="card border-2 border-blue-200 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg px-2 py-1 text-xl hover:bg-zinc-100">✕</button>
      </div>
      {children}
    </section>
  );
}

function Big({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
