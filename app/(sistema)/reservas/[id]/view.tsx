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
import { effectiveCheckOut } from "@/lib/folio/rules";
import { GuestFields, readGuest, readTrip, readVehicle, TripFields, VehicleFields } from "../guest-fields";
import { missingFnrh, PURPOSE_LABEL, TRANSPORT_LABEL } from "@/lib/guests/fnrh";
import { StayForm } from "../stay-form";
import type { FolioView } from "@/lib/folio/service";
import { Balance, Folio, PaymentForm } from "./folio";
import type { PaymentOptions } from "@/components/payment-picker";
import {
  addCompanionAction,
  addVehicleAction,
  assignRoomAction,
  cancelAction,
  checkInAction,
  checkOutAction,
  freeRoomsAction,
  moveRoomAction,
  reactivateAction,
  undoCheckInAction,
  undoCheckOutAction,
  postNightsAction,
  readyRoomsAction,
  removeCompanionAction,
  updateGuestAndTripAction,
  vehicleExitAction,
  type ActionResult,
} from "../actions";

import { useT } from "@/components/i18n";
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
  conta: "Conta",
  estorno: "Estorno",
  desfeito: "Desfeito",
  reativada: "Reserva reativada",
  portal: "Portal",
};

export function ReservationView({
  r,
  today,
  plans,
  types,
  canManage,
  folio,
  canPost,
  canReverse,
  paymentOptions,
  canUndo,
  initialAction,
}: {
  r: ReservationDetail;
  today: DateStr;
  plans: RatePlanView[];
  types: { id: string; name: string; capacity: number }[];
  canManage: boolean;
  folio: FolioView;
  canPost: boolean;
  canReverse: boolean;
  paymentOptions: PaymentOptions;
  canUndo: boolean;
  initialAction: "checkin" | "checkout" | null;
}) {
  const tr = useT();
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
          <Link href="/reservas" className="text-sm text-blue-700 underline">{tr("← Reservas")}</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold">{tr("Reserva nº {0}", [r.number])}<span className={`rounded px-2 py-0.5 text-sm font-semibold ${STATUS[r.status].chip}`}>{tr(STATUS[r.status].label)}</span>
            {late && <span className="rounded bg-red-600 px-2 py-0.5 text-sm text-white">{tr("atrasada")}</span>}
            {leavingToday && <span className="rounded bg-amber-500 px-2 py-0.5 text-sm text-white">{tr("sai hoje")}</span>}
          </h1>
          <LiveRefresher types={["reservations.changed"]} />
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {confirmed && (
              <>
                <button className="btn bg-emerald-600 px-5 py-3 text-white hover:bg-emerald-700" onClick={() => setPanel("checkin")}>{tr("🛎 Fazer check-in")}</button>
                <button className="btn-secondary" onClick={() => setPanel("quarto")}>{tr("Escolher quarto")}</button>
                <button className="btn-secondary" onClick={() => setPanel("editar")}>{tr("Alterar")}</button>
                {r.checkIn <= today && <button className="btn-secondary" onClick={() => setPanel("noshow")}>{tr("Não compareceu")}</button>}
                <button className="btn-secondary text-red-700" onClick={() => setPanel("cancelar")}>{tr("Cancelar")}</button>
              </>
            )}
            {inHouse && (
              <>
                <button className="btn bg-blue-600 px-5 py-3 text-white hover:bg-blue-700" onClick={() => setPanel("checkout")}>{tr("🧳 Fazer check-out")}</button>
                <button className="btn-secondary" onClick={() => setPanel("trocar")}>{tr("⇄ Trocar quarto")}</button>
                <button className="btn-secondary" onClick={() => setPanel("editar")}>{tr("Alterar saída / valores")}</button>
                <button className="btn-secondary" onClick={() => setPanel("veiculo")}>{tr("🚗 Veículo")}</button>
              </>
            )}
          </div>
        )}
      </div>

      {canUndo && (inHouse || r.status === "FINALIZADA" || r.status === "CANCELADA" || r.status === "NO_SHOW") && (
        <UndoBar
          label={inHouse ? tr("↶ Desfazer check-in") : r.status === "FINALIZADA" ? tr("↶ Desfazer check-out") : tr("↶ Reativar reserva")}
          hint={
            inHouse ? tr("Check-in feito por engano? A reserva volta a confirmada e o quarto fica livre (a conta precisa estar sem lançamentos).") : r.status === "FINALIZADA" ? tr("Check-out feito por engano? O hóspede volta para o mesmo quarto, se ele ainda estiver livre.") : tr("Cancelada ou marcada “não compareceu” por engano? A reserva volta a confirmada, se ainda houver quarto.")
          }
          action={(reason) => (inHouse ? undoCheckInAction(r.id, reason) : r.status === "FINALIZADA" ? undoCheckOutAction(r.id, reason) : reactivateAction(r.id, reason))}
          onDone={done}
        />
      )}

      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ {tr(message)} <button className="ml-2 underline" onClick={() => setMessage(null)}>{tr("ok")}</button>
        </p>
      )}

      {panel === "checkin" && <CheckInPanel r={r} today={today} onClose={() => setPanel(null)} onDone={done} />}
      {panel === "checkout" && <CheckOutPanel r={r} today={today} folio={folio} canPost={canPost} paymentOptions={paymentOptions} onClose={() => setPanel(null)} onDone={done} onStep={() => router.refresh()} />}
      {panel === "trocar" && <MovePanel r={r} today={today} onClose={() => setPanel(null)} onDone={done} />}
      {panel === "quarto" && <AssignPanel r={r} onClose={() => setPanel(null)} onDone={done} />}
      {(panel === "cancelar" || panel === "noshow") && <CancelPanel r={r} noShow={panel === "noshow"} onClose={() => setPanel(null)} onDone={done} />}
      {panel === "veiculo" && <VehiclePanel r={r} onClose={() => setPanel(null)} onDone={done} />}
      {panel === "editar" && (
        <Box title={tr("Alterar reserva")} onClose={() => setPanel(null)}>
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
            <Big label={tr("Entrada")} value={`${formatDate(r.checkIn)} ${tr(weekday(r.checkIn))}`} />
            <Big label={tr("Saída")} value={`${formatDate(r.checkOut)} ${tr(weekday(r.checkOut))}`} />
            <Big label={tr("Quarto")} value={r.roomNumber ?? tr("a definir")} hint={r.roomTypeName} />
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Item k="Noites" v={String(nightsBetween(r.checkIn, r.checkOut))} />
            <Item k="Pessoas" v={tr("{0} adulto(s)", [r.adults]) + (r.children ? " + " + tr("{0} criança(s)", [r.children]) : "")} />
            <Item k="Origem" v={`${tr(SOURCE_LABEL[r.source])}${r.externalCode ? ` · nº ${r.externalCode}` : ""}`} />
            <Item k="Tarifa" v={r.ratePlanName ?? tr("valor manual")} />
            <Item k="Café da manhã" v={r.breakfast ? tr("incluído") : tr("não incluído")} />
            <Item k="Criada por" v={tr("{0} em {1}", [r.createdByName ?? tr("Sistema"), dateTime(r.createdAt)])} />
            {r.checkedInAt && <Item k="Check-in" v={dateTime(r.checkedInAt)} />}
            {r.checkedOutAt && <Item k="Check-out" v={dateTime(r.checkedOutAt)} />}
            {r.cancelReason && <Item k="Motivo" v={r.cancelReason} />}
          </dl>
          {r.notes && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm">📝 {r.notes}</p>}
        </section>

        <section className="card p-5">
          <h2 className="mb-2 font-semibold">{tr("Valores previstos")}</h2>
          <dl className="space-y-1 text-sm">
            <Item k={tr("{0} × diária", [r.totals.nights])} v={`${formatBRL(r.dailyCents)} = ${formatBRL(r.totals.lodging)}`} />
            {r.chargeIss && <Item k={`ISS ${formatPercent(r.issBasisPoints)}`} v={formatBRL(r.totals.iss)} />}
            <div className="mt-2 border-t border-zinc-200 pt-2 text-lg font-bold">{formatBRL(r.totals.total)}</div>
          </dl>
          <p className="mt-2 text-xs text-zinc-500">{tr("Previsto pela reserva. O que vale é a conta abaixo.")}</p>
        </section>
      </div>

      <Folio reservationId={r.id} options={paymentOptions} folio={folio} status={r.status} canPost={canPost} canReverse={canReverse} onDone={done} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{tr("Hóspede titular")}</h2>
            {canManage && panel !== "hospede" && <button className="text-sm text-blue-700 underline" onClick={() => setPanel("hospede")}>{tr("editar")}</button>}
          </div>
          {panel === "hospede" ? (
            <GuestEdit r={r} onClose={() => setPanel(null)} onDone={done} />
          ) : (
            <div className="text-sm">
              <div className="text-lg font-semibold">{r.guest.fullName}</div>
              <div className="text-zinc-600">
                {[r.guest.docType && r.guest.docNumber ? `${r.guest.docType} ${r.guest.docNumber}` : tr("sem documento"), r.guest.phone, r.guest.email].filter(Boolean).join(" · ")}
              </div>
              {(r.guest.city || r.guest.state) && <div className="text-zinc-500">{[r.guest.city, r.guest.state].filter(Boolean).join(" / ")}</div>}
              {(r.trip.travelPurpose || r.trip.transport || r.trip.arrivingFrom) && (
                <div className="text-zinc-500">
                  {[r.trip.travelPurpose && tr(PURPOSE_LABEL[r.trip.travelPurpose]), r.trip.transport && tr(TRANSPORT_LABEL[r.trip.transport]), r.trip.arrivingFrom && tr("vem de {0}", [r.trip.arrivingFrom]), r.trip.nextDestination && tr("vai para {0}", [r.trip.nextDestination])].filter(Boolean).join(" · ")}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a href={`/reservas/${r.id}/fnrh`} target="_blank" className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-semibold hover:bg-zinc-50">{tr("🖨 Ficha FNRH")}</a>
                {missingFnrh(r.guest).length > 0 && (
                  <span className="text-xs text-amber-700">{tr("Ficha incompleta: {0}", [missingFnrh(r.guest).map((m) => tr(m)).join(", ")])}</span>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{tr("Acompanhantes ({0})", [r.companions.length])}</h3>
            {canManage && (confirmed || inHouse) && panel !== "acompanhante" && (
              <button className="text-sm text-blue-700 underline" onClick={() => setPanel("acompanhante")}>{tr("+ incluir")}</button>
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
          <h2 className="mb-2 font-semibold">{tr("Veículos")}</h2>
          {r.vehicleList.length === 0 ? (
            <p className="text-sm text-zinc-500">{tr("Nenhum veículo.")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {r.vehicleList.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1">
                  <span>
                    <b>{v.plate}</b> {[v.model, v.color].filter(Boolean).join(" ")} {v.spot && tr("· vaga {0}", [v.spot])}
                    <span className="block text-xs text-zinc-500">{tr("entrou {0}{1}", [dateTime(v.enteredAt), v.exitedAt ? tr(" · saiu {0}", [dateTime(v.exitedAt)]) : tr(" · na garagem")])}</span>
                  </span>
                  {canManage && !v.exitedAt && <VehicleExit vehicleId={v.id} onDone={done} />}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-5 mb-2 font-semibold">{tr("Histórico")}</h2>
          <ol className="space-y-2 text-sm">
            {r.events.map((e) => (
              <li key={e.id} className="border-l-2 border-zinc-200 pl-3">
                <b>{tr(EVENT_LABEL[e.type] ?? e.type)}</b>
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
  const tr = useT();
  const [others, setOthers] = useState(false);
  if (!rooms) return <p className="text-sm text-zinc-400">{tr("Buscando quartos...")}</p>;
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
        {list.length === 0 && <p className="text-sm text-amber-700">{tr("Nenhum quarto disponível deste tipo.")}</p>}
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-600">
        <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} />{" "}{tr("mostrar outros tipos (upgrade)")}</label>
    </div>
  );
}

function CheckInPanel({ r, today, onClose, onDone }: PanelProps & { today: DateStr }) {
  const tr = useT();
  const rooms = useRooms(() => readyRoomsAction(today < r.checkIn ? r.checkIn : today, r.checkOut, r.id));
  const [roomId, setRoomId] = useState(r.roomId ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, state, run } = useAction();
  const assignedNotReady = rooms && r.roomId && !rooms.some((x) => x.id === r.roomId);
  const effectiveRoom = assignedNotReady && roomId === r.roomId ? "" : roomId;

  return (
    <Box title={tr("Check-in — {0}", [r.guest.fullName])} onClose={onClose}>
      <form
        ref={formRef}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = formRef.current!;
          run(
            () => checkInAction(r.id, { roomId: effectiveRoom, guest: readGuest(form), vehicle: readVehicle(form), trip: readTrip(form) }),
            () => onDone("Check-in feito. Bem-vindo!")
          );
        }}
      >
        {r.checkIn > today && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{tr("A reserva é para {0}. Altere a entrada para hoje antes do check-in.", [formatDate(r.checkIn)])}</p>
        )}
        <div>
          <h3 className="mb-2 text-sm font-semibold">{tr("1. Quarto (só limpos e livres)")}</h3>
          {assignedNotReady && (
            <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{tr("O quarto reservado ({0}) ainda não está pronto. Escolha outro ou peça prioridade à governança.", [r.roomNumber])}</p>
          )}
          <RoomPicker rooms={rooms} value={effectiveRoom} onChange={setRoomId} typeId={r.roomTypeId} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">{tr("2. Confira a ficha do hóspede")}</h3>
          <GuestFields initial={r.guest} errors={state.fieldErrors} requireDoc />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">{tr("3. Viagem (ficha FNRH)")}</h3>
          <TripFields initial={r.trip} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">{tr("4. Veículo (opcional)")}</h3>
          <VehicleFields errors={state.fieldErrors} />
        </div>
        <FormMessage error={state.error} />
        <button type="submit" className="btn bg-emerald-600 px-6 py-3 text-white hover:bg-emerald-700" disabled={pending || !effectiveRoom}>
          {pending ? tr("Fazendo check-in...") : tr("Confirmar check-in")}
        </button>
      </form>
    </Box>
  );
}

// Check-out em 3 passos: lançar as diárias que faltam → receber →
// confirmar. O servidor confere de novo (conta precisa estar zerada).
function CheckOutPanel({
  r,
  today,
  folio,
  canPost,
  onClose,
  onDone,
  onStep,
  paymentOptions,
}: PanelProps & { today: DateStr; folio: FolioView; canPost: boolean; onStep: () => void; paymentOptions: PaymentOptions }) {
  const tr = useT();
  const { pending, state, run } = useAction();
  const [stepMsg, setStepMsg] = useState<string | null>(null);
  // Antecipada só se a saída efetiva encurta a estadia (1 noite é o mínimo).
  const early = effectiveCheckOut(r.checkIn, r.checkOut, today) < r.checkOut;
  const cars = r.vehicleList.filter((v) => !v.exitedAt);
  const nightsLeft = folio.checkoutNights.length;
  const settled = nightsLeft === 0 && folio.balance === 0;
  const step = (msg: string) => {
    setStepMsg(msg);
    onStep();
  };

  return (
    <Box title={tr("Check-out — quarto {0}", [r.roomNumber])} onClose={onClose}>
      <ol className="space-y-4">
        <Step n={1} done={nightsLeft === 0} title={tr("Fechar a conta (diárias)")}>
          {nightsLeft > 0 ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>{tr("Faltam {0} diária(s): {1} —", [nightsLeft, folio.checkoutNights.map((n) => formatDate(n)).join(", ")])}<b>{formatBRL(folio.checkoutPreview)}</b>{" "}{tr("(com ISS{0}).", [folio.parkingDailyCents > 0 ? tr(" e garagem") : ""])}</span>
              {canPost && (
                <button
                  className="btn-primary"
                  disabled={pending}
                  onClick={() => run(() => postNightsAction(r.id, true), () => step("Diárias lançadas."))}
                >{tr("Lançar diárias")}</button>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">{tr("Todas as diárias da estadia estão na conta.")}</p>
          )}
          {early && <p className="mt-1 text-xs text-amber-700">{tr("Saída antecipada: a reserva era até {0}. As noites não usadas não são cobradas.", [formatDate(r.checkOut)])}</p>}
        </Step>

        <Step n={2} done={nightsLeft === 0 && folio.balance === 0} title={tr("Receber o pagamento")}>
          <div className="flex flex-wrap items-center gap-3">
            <Balance balance={folio.balance} />
            {folio.balance < 0 && <p className="text-sm text-sky-800">{tr("O hóspede pagou a mais: use “Devolver crédito” na conta abaixo.")}</p>}
          </div>
          {folio.balance > 0 && nightsLeft === 0 && canPost && (
            <PaymentForm reservationId={r.id} suggested={folio.balance} options={paymentOptions} onClose={() => undefined} onDone={step} />
          )}
        </Step>

        <Step n={3} done={false} title={tr("Confirmar a saída")}>
          <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">
            <li>{tr("O quarto {0} fica livre e vai para a governança como", [r.roomNumber])}{" "}<b>{tr("sujo")}</b>.</li>
            {cars.length > 0 && <li>{tr("Saída na garagem: {0}.", [cars.map((v) => v.plate).join(", ")])}</li>}
          </ul>
          <button
            className="btn bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
            disabled={pending || !settled}
            title={settled ? undefined : tr("Feche a conta primeiro")}
            onClick={() => run(() => checkOutAction(r.id), () => onDone("Check-out feito. Quarto enviado para a governança."))}
          >
            {pending ? tr("Aguarde...") : tr("Confirmar check-out")}
          </button>
        </Step>
      </ol>
      {stepMsg && !state.error && <p className="mt-3 text-sm text-emerald-700">✓ {tr(stepMsg)}</p>}
      <FormMessage error={state.error} />
    </Box>
  );
}

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  const tr = useT();
  return (
    <li className="flex gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-700"}`}>
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-semibold">{tr(title)}</div>
        {children}
      </div>
    </li>
  );
}

function MovePanel({ r, today, onClose, onDone }: PanelProps & { today: DateStr }) {
  const tr = useT();
  const rooms = useRooms(() => readyRoomsAction(today, r.checkOut, r.id));
  const [roomId, setRoomId] = useState("");
  const [reason, setReason] = useState("");
  const { pending, state, run } = useAction();
  return (
    <Box title={tr("Trocar quarto — hoje no {0}", [r.roomNumber])} onClose={onClose}>
      <div className="space-y-3">
        <RoomPicker rooms={rooms} value={roomId} onChange={setRoomId} typeId={r.roomTypeId} />
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("Motivo (ex.: ar-condicionado com defeito, pedido do hóspede)")} maxLength={300} />
        <p className="text-xs text-zinc-500">{tr("O quarto {0} fica livre e vai para a governança como sujo. A diária combinada continua a mesma.", [r.roomNumber])}</p>
        <FormMessage error={state.error} />
        <button className="btn-primary" disabled={pending || !roomId || reason.trim().length < 3} onClick={() => run(() => moveRoomAction(r.id, roomId, reason), () => onDone("Troca de quarto feita."))}>
          {pending ? tr("Trocando...") : tr("Confirmar troca")}
        </button>
      </div>
    </Box>
  );
}

function AssignPanel({ r, onClose, onDone }: PanelProps) {
  const tr = useT();
  const rooms = useRooms(() => freeRoomsAction(r.checkIn, r.checkOut, r.id));
  const [roomId, setRoomId] = useState(r.roomId ?? "");
  const { pending, state, run } = useAction();
  return (
    <Box title={tr("Escolher quarto da reserva")} onClose={onClose}>
      <p className="mb-2 text-xs text-zinc-500">{tr("Quartos sem outra reserva de {0} a {1} (não precisam estar limpos agora).", [formatDate(r.checkIn), formatDate(r.checkOut)])}</p>
      <RoomPicker rooms={rooms} value={roomId} onChange={setRoomId} typeId={r.roomTypeId} />
      <FormMessage error={state.error} />
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" disabled={pending || !roomId || roomId === r.roomId} onClick={() => run(() => assignRoomAction(r.id, roomId), () => onDone("Quarto definido."))}>{tr("Salvar quarto")}</button>
        {r.roomId && (
          <button className="btn-secondary" disabled={pending} onClick={() => run(() => assignRoomAction(r.id, null), () => onDone("Quarto liberado."))}>{tr("Deixar sem quarto")}</button>
        )}
      </div>
    </Box>
  );
}

function CancelPanel({ r, noShow, onClose, onDone }: PanelProps & { noShow: boolean }) {
  const tr = useT();
  const [reason, setReason] = useState(noShow ? "Hóspede não compareceu" : "");
  const { pending, state, run } = useAction();
  return (
    <Box title={noShow ? tr("Marcar como não compareceu (no-show)") : tr("Cancelar reserva")} onClose={onClose}>
      <div className="space-y-3">
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("Motivo")} maxLength={300} />
        <FormMessage error={state.error} />
        <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={pending} onClick={() => run(() => cancelAction(r.id, reason, noShow), () => onDone(noShow ? "Marcada como não compareceu." : "Reserva cancelada."))}>{tr("Confirmar")}</button>
      </div>
    </Box>
  );
}

function VehiclePanel({ r, onClose, onDone }: PanelProps) {
  const tr = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, state, run } = useAction();
  return (
    <Box title={tr("Registrar veículo na garagem")} onClose={onClose}>
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
        <button className="btn-primary" disabled={pending}>{tr("Registrar entrada")}</button>
      </form>
    </Box>
  );
}

function GuestEdit({ r, onClose, onDone }: PanelProps) {
  const tr = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, state, run } = useAction();
  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateGuestAndTripAction(r.id, r.guest.id, readGuest(formRef.current!), readTrip(formRef.current!)), () => onDone("Dados do hóspede salvos."));
      }}
    >
      <GuestFields initial={r.guest} errors={state.fieldErrors} />
      <h3 className="pt-2 text-sm font-semibold">{tr("Viagem (ficha FNRH)")}</h3>
      <TripFields initial={r.trip} />
      <FormMessage error={state.fieldErrors ? undefined : state.error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{tr("Salvar")}</button>
        <button type="button" className="btn-secondary" onClick={onClose}>{tr("Cancelar")}</button>
      </div>
    </form>
  );
}

function CompanionAdd({ r, onClose, onDone }: PanelProps) {
  const tr = useT();
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
        <button className="btn-primary" disabled={pending}>{tr("Incluir")}</button>
        <button type="button" className="btn-secondary" onClick={onClose}>{tr("Cancelar")}</button>
      </div>
    </form>
  );
}

function RemoveCompanion({ reservationId, guestId, onDone }: { reservationId: string; guestId: string; onDone: (m: string) => void }) {
  const tr = useT();
  const { pending, run } = useAction();
  return (
    <button className="text-xs text-red-700 underline" disabled={pending} onClick={() => run(() => removeCompanionAction(reservationId, guestId), () => onDone("Acompanhante removido."))}>{tr("remover")}</button>
  );
}

function VehicleExit({ vehicleId, onDone }: { vehicleId: string; onDone: (m: string) => void }) {
  const tr = useT();
  const { pending, run } = useAction();
  return (
    <button className="btn-secondary px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => vehicleExitAction(vehicleId), () => onDone("Saída do veículo registrada."))}>{tr("registrar saída")}</button>
  );
}

// ----------------------------------------------------------------

function Box({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const tr = useT();
  return (
    <section className="card border-2 border-blue-200 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{tr(title)}</h2>
        <button type="button" onClick={onClose} aria-label={tr("Fechar")} className="rounded-lg px-2 py-1 text-xl hover:bg-zinc-100">✕</button>
      </div>
      {children}
    </section>
  );
}

function Big({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const tr = useT();
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <div className="text-xs text-zinc-500">{tr(label)}</div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-xs text-zinc-500">{tr(hint)}</div>}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  const tr = useT();
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-500">{tr(k)}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

// Barra discreta de "desfazer" (gerente/admin), com motivo obrigatório.
function UndoBar({
  label,
  hint,
  action,
  onDone,
}: {
  label: string;
  hint: string;
  action: (reason: string) => Promise<ActionResult>;
  onDone: (msg: string) => void;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, state, run } = useAction();
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-3 text-sm">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-zinc-600">{tr(hint)}</span>
          <button className="btn-secondary px-3 py-1.5" onClick={() => setOpen(true)}>{tr(label)}</button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="font-semibold">{tr(label)}</div>
          <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("Motivo (ex.: cliquei na reserva errada)")} maxLength={300} autoFocus />
          <FormMessage error={state.error} />
          <div className="flex gap-2">
            <button className="btn bg-zinc-900 text-white" disabled={pending || reason.trim().length < 5} onClick={() => run(() => action(reason), () => onDone("Feito. Ficou registrado no histórico."))}>{tr("Confirmar")}</button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>{tr("Voltar")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
