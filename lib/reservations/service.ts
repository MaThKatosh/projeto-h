import { z } from "zod";
import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { fieldErrors } from "@/lib/auth/validation";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { addDays, fromDateStr, nightsBetween, toDateStr, type DateStr } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getBusinessDate } from "@/lib/hotel-date";
import { applyRoomChanges, type RoomView } from "@/lib/rooms/service";
import { guestData, guestSelect, toGuestView, type GuestView } from "@/lib/guests/service";
import { checkoutBlocker } from "@/lib/folio/service";
import { effectiveCheckOut, folioTotals } from "@/lib/folio/rules";
import {
  ACTIVE_STATUSES,
  computeTotals,
  freeByNight,
  guestSchema,
  roomReadyReason,
  stayFields,
  vehicleSchema,
  type ReservationStatus,
  type Source,
  type StayInput,
} from "@/lib/reservations/rules";

// ================================================================
// RESERVAS E ESTADIAS
// ================================================================
//
// Uma reserva vira estadia no check-in (status HOSPEDADA). A ocupação do
// quarto só muda aqui: check-in, check-out e troca de quarto. Tudo que
// mexe em quarto devolve os quartos alterados para o aviso ao vivo.

type Result<T = object> = ({ ok: true } & T) | Failure;
type Rooms = { rooms: RoomView[] };

function invalid(error: z.ZodError): Failure {
  return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(error) };
}

function denied(actor: SessionUser): Failure | null {
  return can(actor.role, "reservations.manage") ? null : { ok: false, error: "Seu cargo não pode mexer em reservas." };
}

async function event(db: Db, reservationId: string, userId: string | null, type: string, message?: string | null) {
  await db.reservationEvent.create({ data: { reservationId, userId, type, message: message ?? null } });
}

// Evita duas pessoas vendendo o último quarto de um tipo ao mesmo tempo:
// operações que mudam ocupação de um tipo entram numa "fila" por tipo.
async function lockRoomType(db: Db, roomTypeId: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"roomType:" + roomTypeId}))`;
}

function overlapError(error: unknown): string | null {
  const text = String((error as { message?: string })?.message ?? error);
  if (text.includes("Reservation_no_room_overlap") || text.includes("23P01")) {
    return "Este quarto já tem outra reserva nessas datas. Escolha outro quarto.";
  }
  return null;
}

// ----------------------------------------------------------------
// DISPONIBILIDADE
// ----------------------------------------------------------------

export type Availability = { roomTypeId: string; name: string; capacity: number; total: number; free: number; byNight: number[] };

export async function availability(
  db: Db,
  from: DateStr,
  to: DateStr,
  options: { ignoreReservationId?: string } = {}
): Promise<Availability[]> {
  const nights = Array.from({ length: Math.max(1, nightsBetween(from, to)) }, (_, i) => addDays(from, i));
  const [types, reservations] = await Promise.all([
    db.roomType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        capacity: true,
        _count: { select: { rooms: { where: { active: true, maintenance: { not: "BLOQUEADO" } } } } },
      },
    }),
    db.reservation.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        checkIn: { lt: fromDateStr(to) },
        checkOut: { gt: fromDateStr(from) },
        ...(options.ignoreReservationId ? { id: { not: options.ignoreReservationId } } : {}),
      },
      select: { roomTypeId: true, checkIn: true, checkOut: true },
    }),
  ]);

  return types.map((t) => {
    const mine = reservations
      .filter((r) => r.roomTypeId === t.id)
      .map((r) => ({ checkIn: toDateStr(r.checkIn), checkOut: toDateStr(r.checkOut) }));
    const byNight = freeByNight(t._count.rooms, mine, nights);
    return { roomTypeId: t.id, name: t.name, capacity: t.capacity, total: t._count.rooms, free: Math.min(...byNight), byNight };
  });
}

async function ensureAvailable(db: Db, roomTypeId: string, from: DateStr, to: DateStr, ignoreReservationId?: string) {
  await lockRoomType(db, roomTypeId);
  const list = await availability(db, from, to, { ignoreReservationId });
  const type = list.find((t) => t.roomTypeId === roomTypeId);
  if (!type) return "Tipo de quarto não encontrado.";
  if (type.free < 1) {
    return `Não há ${type.name} livre em todas essas noites. Veja a disponibilidade e tente outras datas ou outro tipo.`;
  }
  return null;
}

// Quarto pode ser usado por esta reserva nessas datas?
async function checkRoomForStay(db: Db, roomId: string, from: DateStr, to: DateStr, reservationId?: string) {
  const room = await db.room.findUnique({ where: { id: roomId }, select: { id: true, active: true, roomTypeId: true, number: true, maintenance: true } });
  if (!room?.active) return { error: "Quarto não encontrado." } as const;
  if (room.maintenance === "BLOQUEADO") return { error: `O quarto ${room.number} está bloqueado.` } as const;
  const clash = await db.reservation.findFirst({
    where: {
      roomId,
      status: { in: ACTIVE_STATUSES },
      checkIn: { lt: fromDateStr(to) },
      checkOut: { gt: fromDateStr(from) },
      ...(reservationId ? { id: { not: reservationId } } : {}),
    },
    select: { number: true, guest: { select: { fullName: true } } },
  });
  if (clash) {
    return { error: `O quarto ${room.number} já está reservado nessas datas (reserva nº ${clash.number}, ${clash.guest.fullName}).` } as const;
  }
  return { room } as const;
}

// ----------------------------------------------------------------
// LEITURA
// ----------------------------------------------------------------

export type ReservationRow = {
  id: string;
  number: number;
  status: ReservationStatus;
  guestName: string;
  roomTypeName: string;
  roomTypeId: string;
  roomId: string | null;
  roomNumber: string | null;
  checkIn: DateStr;
  checkOut: DateStr;
  adults: number;
  children: number;
  source: Source;
  externalCode: string | null;
  dailyCents: number;
  vehicles: number;
};

const rowSelect = {
  id: true,
  number: true,
  status: true,
  checkIn: true,
  checkOut: true,
  adults: true,
  children: true,
  source: true,
  externalCode: true,
  dailyCents: true,
  roomId: true,
  roomTypeId: true,
  guest: { select: { fullName: true } },
  roomType: { select: { name: true } },
  room: { select: { number: true } },
  _count: { select: { vehicles: { where: { exitedAt: null } } } },
} as const;

type RawRow = Awaited<ReturnType<typeof findRows>>[number];

function findRows(db: Db, where: object, orderBy: object = { checkIn: "asc" }, take?: number) {
  return db.reservation.findMany({ where, select: rowSelect, orderBy, take });
}

function toRow(r: RawRow): ReservationRow {
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    guestName: r.guest.fullName,
    roomTypeName: r.roomType.name,
    roomTypeId: r.roomTypeId,
    roomId: r.roomId,
    roomNumber: r.room?.number ?? null,
    checkIn: toDateStr(r.checkIn),
    checkOut: toDateStr(r.checkOut),
    adults: r.adults,
    children: r.children,
    source: r.source,
    externalCode: r.externalCode,
    dailyCents: r.dailyCents,
    vehicles: r._count.vehicles,
  };
}

export type ListFilter = "chegadas" | "emCasa" | "saidas" | "futuras" | "todas";

export async function listReservations(db: Db, filter: ListFilter, search: string, today: DateStr): Promise<ReservationRow[]> {
  const q = search.trim();
  const text = q
    ? {
        OR: [
          { guest: { fullName: { contains: q, mode: "insensitive" as const } } },
          { externalCode: { contains: q, mode: "insensitive" as const } },
          ...(/^\d+$/.test(q) ? [{ number: Number(q) }] : []),
          { room: { number: q } },
        ],
      }
    : {};
  const day = fromDateStr(today);
  const where = {
    chegadas: { status: "CONFIRMADA", checkIn: { lte: day } },
    emCasa: { status: "HOSPEDADA" },
    saidas: { status: "HOSPEDADA", checkOut: { lte: day } },
    futuras: { status: "CONFIRMADA", checkIn: { gt: day } },
    todas: {},
  }[filter];
  const rows = await findRows(db, { ...where, ...text }, filter === "todas" ? { createdAt: "desc" } : { checkIn: "asc" }, 200);
  return rows.map(toRow);
}

// Recepção: o dia de hoje.
export async function frontDesk(db: Db, today: DateStr) {
  const day = fromDateStr(today);
  const [arrivals, departures, inHouse] = await Promise.all([
    findRows(db, { status: "CONFIRMADA", checkIn: { lte: day } }),
    findRows(db, { status: "HOSPEDADA", checkOut: { lte: day } }, { checkOut: "asc" }),
    db.reservation.aggregate({
      where: { status: "HOSPEDADA" },
      _count: true,
      _sum: { adults: true, children: true },
    }),
  ]);
  return {
    arrivals: arrivals.map(toRow),
    departures: departures.map(toRow),
    inHouse: {
      rooms: inHouse._count,
      adults: inHouse._sum.adults ?? 0,
      children: inHouse._sum.children ?? 0,
    },
  };
}

export type ReservationDetail = ReservationRow & {
  roomTypeId: string;
  ratePlanId: string | null;
  ratePlanName: string | null;
  breakfast: boolean;
  chargeIss: boolean;
  issBasisPoints: number;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  createdByName: string | null;
  guest: GuestView;
  companions: GuestView[];
  vehicleList: { id: string; plate: string; model: string | null; color: string | null; spot: string | null; enteredAt: string; exitedAt: string | null }[];
  events: { id: string; type: string; message: string | null; userName: string; createdAt: string }[];
  totals: ReturnType<typeof computeTotals>;
};

export async function getReservation(db: Db, id: string): Promise<ReservationDetail | null> {
  const r = await db.reservation.findUnique({
    where: { id },
    select: {
      ...rowSelect,
      ratePlanId: true,
      ratePlan: { select: { name: true } },
      breakfast: true,
      chargeIss: true,
      issBasisPoints: true,
      notes: true,
      cancelReason: true,
      createdAt: true,
      checkedInAt: true,
      checkedOutAt: true,
      createdBy: { select: { fullName: true } },
      guest: { select: guestSelect },
      companions: { select: { guest: { select: guestSelect } } },
      vehicles: { orderBy: { enteredAt: "asc" }, select: { id: true, plate: true, model: true, color: true, spot: true, enteredAt: true, exitedAt: true } },
      events: { orderBy: { createdAt: "asc" }, select: { id: true, type: true, message: true, createdAt: true, user: { select: { fullName: true } } } },
    },
  });
  if (!r) return null;
  const row = toRow({ ...r, guest: { fullName: r.guest.fullName } } as RawRow);
  return {
    ...row,
    ratePlanId: r.ratePlanId,
    ratePlanName: r.ratePlan?.name ?? null,
    breakfast: r.breakfast,
    chargeIss: r.chargeIss,
    issBasisPoints: r.issBasisPoints,
    notes: r.notes,
    cancelReason: r.cancelReason,
    createdAt: r.createdAt.toISOString(),
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    checkedOutAt: r.checkedOutAt?.toISOString() ?? null,
    createdByName: r.createdBy?.fullName ?? null,
    guest: toGuestView(r.guest),
    companions: r.companions.map((c) => toGuestView(c.guest)),
    vehicleList: r.vehicles.map((v) => ({ ...v, enteredAt: v.enteredAt.toISOString(), exitedAt: v.exitedAt?.toISOString() ?? null })),
    events: r.events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      userName: e.user?.fullName ?? "Sistema",
      createdAt: e.createdAt.toISOString(),
    })),
    totals: computeTotals({
      nights: nightsBetween(row.checkIn, row.checkOut),
      dailyCents: r.dailyCents,
      chargeIss: r.chargeIss,
      issBasisPoints: r.issBasisPoints,
    }),
  };
}

// Mapa de reservas: quartos x dias.
export async function reservationGrid(db: Db, from: DateStr, days: number) {
  const to = addDays(from, days);
  const [rooms, reservations] = await Promise.all([
    db.room.findMany({
      where: { active: true },
      select: { id: true, number: true, floor: true, roomTypeId: true, maintenance: true, roomType: { select: { name: true } } },
    }),
    findRows(db, {
      status: { in: [...ACTIVE_STATUSES, "FINALIZADA"] },
      checkIn: { lt: fromDateStr(to) },
      checkOut: { gt: fromDateStr(from) },
    }),
  ]);
  return {
    from,
    days,
    rooms: rooms.map((r) => ({ id: r.id, number: r.number, floor: r.floor, roomTypeId: r.roomTypeId, typeName: r.roomType.name, blocked: r.maintenance === "BLOQUEADO" })),
    reservations: reservations.map(toRow),
  };
}

// Para o mapa de quartos: quem está em cada quarto e quem chega hoje.
export async function roomOccupants(db: Db, today: DateStr) {
  const rows = await db.reservation.findMany({
    where: {
      roomId: { not: null },
      OR: [{ status: "HOSPEDADA" }, { status: "CONFIRMADA", checkIn: { lte: fromDateStr(today) } }],
    },
    select: { id: true, roomId: true, status: true, checkOut: true, guest: { select: { fullName: true } } },
  });
  const map: Record<string, { reservationId: string; guestName: string; checkOut: DateStr; arriving: boolean }> = {};
  for (const r of rows) {
    if (!r.roomId) continue;
    if (map[r.roomId] && r.status !== "HOSPEDADA") continue;
    map[r.roomId] = { reservationId: r.id, guestName: r.guest.fullName, checkOut: toDateStr(r.checkOut), arriving: r.status === "CONFIRMADA" };
  }
  return map;
}

// ----------------------------------------------------------------
// CRIAR
// ----------------------------------------------------------------

const createSchema = z.object({
  guestId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  guest: guestSchema.optional(),
  stay: stayFields,
});

function stayData(s: StayInput) {
  return {
    checkIn: fromDateStr(s.checkIn),
    checkOut: fromDateStr(s.checkOut),
    adults: s.adults,
    children: s.children,
    roomTypeId: s.roomTypeId,
    ratePlanId: s.ratePlanId ?? null,
    dailyCents: s.daily,
    breakfast: s.breakfast,
    chargeIss: s.chargeIss,
    issBasisPoints: Math.round(s.issPercent * 100),
    source: s.source,
    externalCode: s.externalCode,
    notes: s.notes,
  };
}

export async function createReservation(
  db: Db,
  actor: SessionUser,
  input: unknown
): Promise<Result<{ id: string; number: number }>> {
  const no = denied(actor);
  if (no) return no;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { guestId, guest, stay } = parsed.data;

  if (!guestId && !guest) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: { fullName: ["Escolha um hóspede ou cadastre um novo."] } };
  }
  const today = await getBusinessDate(db);
  if (stay.checkIn < today) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: { checkIn: ["A entrada não pode ser antes da data do sistema."] } };
  }

  const busy = await ensureAvailable(db, stay.roomTypeId, stay.checkIn, stay.checkOut);
  if (busy) return { ok: false, error: busy };

  let roomTypeId = stay.roomTypeId;
  if (stay.roomId) {
    const check = await checkRoomForStay(db, stay.roomId, stay.checkIn, stay.checkOut);
    if ("error" in check) return { ok: false, error: check.error! };
    roomTypeId = check.room.roomTypeId;
  }

  const holderId = guestId
    ? (await db.guest.findUnique({ where: { id: guestId }, select: { id: true } }))?.id
    : (await db.guest.create({ data: guestData(guest!), select: { id: true } })).id;
  if (!holderId) return { ok: false, error: "Hóspede não encontrado." };

  try {
    const r = await db.reservation.create({
      data: { ...stayData(stay), roomTypeId, roomId: stay.roomId ?? null, guestId: holderId, createdById: actor.id },
      select: { id: true, number: true },
    });
    const totals = computeTotals({ nights: nightsBetween(stay.checkIn, stay.checkOut), dailyCents: stay.daily, chargeIss: stay.chargeIss, issBasisPoints: Math.round(stay.issPercent * 100) });
    await event(db, r.id, actor.id, "criada", `Total previsto ${formatBRL(totals.total)}`);
    await audit(db, "reservation.created", { userId: actor.id, metadata: { number: r.number } });
    return { ok: true, ...r };
  } catch (error) {
    const msg = overlapError(error);
    if (msg) return { ok: false, error: msg };
    throw error;
  }
}

// ----------------------------------------------------------------
// ALTERAR
// ----------------------------------------------------------------

export async function updateReservation(db: Db, actor: SessionUser, id: string, input: unknown): Promise<Result> {
  const no = denied(actor);
  if (no) return no;
  const parsed = stayFields.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const stay = parsed.data;

  const current = await db.reservation.findUnique({
    where: { id },
    select: { status: true, checkIn: true, roomId: true, roomTypeId: true, dailyCents: true, checkOut: true },
  });
  if (!current) return { ok: false, error: "Reserva não encontrada." };
  if (!ACTIVE_STATUSES.includes(current.status)) return { ok: false, error: "Esta reserva está encerrada e não pode ser alterada." };

  const today = await getBusinessDate(db);
  const inHouse = current.status === "HOSPEDADA";

  if (inHouse) {
    // Hospedado: entrada, tipo e quarto não mudam aqui (troca de quarto é outra ação).
    if (stay.checkIn !== toDateStr(current.checkIn)) return { ok: false, error: "Hóspede já entrou: a data de entrada não muda." };
    if (stay.roomTypeId !== current.roomTypeId) return { ok: false, error: "Para mudar de tipo, use a troca de quarto." };
    if (stay.checkOut <= today) {
      return { ok: false, error: "Revise os campos destacados.", fieldErrors: { checkOut: ["Para sair hoje, faça o check-out."] } };
    }
  } else if (stay.checkIn < today) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: { checkIn: ["A entrada não pode ser antes da data do sistema."] } };
  }

  const busy = await ensureAvailable(db, stay.roomTypeId, stay.checkIn, stay.checkOut, id);
  if (busy) return { ok: false, error: busy };

  let roomId = inHouse ? current.roomId : (stay.roomId ?? null);
  let roomTypeId = stay.roomTypeId;
  if (roomId) {
    const check = await checkRoomForStay(db, roomId, stay.checkIn, stay.checkOut, id);
    if ("error" in check) {
      if (inHouse) return { ok: false, error: check.error! };
      // Reserva futura: se o quarto escolhido não serve mais, solta o quarto.
      if (stay.roomId) return { ok: false, error: check.error! };
      roomId = null;
    } else {
      roomTypeId = check.room.roomTypeId;
    }
  }

  try {
    await db.reservation.update({ where: { id }, data: { ...stayData(stay), roomTypeId, roomId } });
  } catch (error) {
    const msg = overlapError(error);
    if (msg) return { ok: false, error: msg };
    throw error;
  }
  const changes: string[] = [];
  if (toDateStr(current.checkOut) !== stay.checkOut) changes.push(`saída ${stay.checkOut.split("-").reverse().join("/")}`);
  if (current.dailyCents !== stay.daily) changes.push(`diária ${formatBRL(current.dailyCents)} → ${formatBRL(stay.daily)}`);
  await event(db, id, actor.id, "alterada", changes.join(" · ") || null);
  await audit(db, "reservation.updated", { userId: actor.id, metadata: { id, changes } });
  return { ok: true };
}

export async function updateGuest(db: Db, actor: SessionUser, guestId: string, input: unknown): Promise<Result> {
  const no = denied(actor);
  if (no) return no;
  const parsed = guestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.guest.update({ where: { id: guestId }, data: guestData(parsed.data) });
  await audit(db, "guest.updated", { userId: actor.id, metadata: { guestId } });
  return { ok: true };
}

export async function addCompanion(db: Db, actor: SessionUser, reservationId: string, input: unknown): Promise<Result> {
  const no = denied(actor);
  if (no) return no;
  const parsed = guestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await db.reservation.findUnique({ where: { id: reservationId }, select: { status: true } });
  if (!r || !ACTIVE_STATUSES.includes(r.status)) return { ok: false, error: "Reserva encerrada." };
  const g = await db.guest.create({ data: guestData(parsed.data), select: { id: true, fullName: true } });
  await db.reservationGuest.create({ data: { reservationId, guestId: g.id } });
  await event(db, reservationId, actor.id, "acompanhante", g.fullName);
  return { ok: true };
}

export async function removeCompanion(db: Db, actor: SessionUser, reservationId: string, guestId: string): Promise<Result> {
  const no = denied(actor);
  if (no) return no;
  const link = await db.reservationGuest.findUnique({
    where: { reservationId_guestId: { reservationId, guestId } },
    select: { guest: { select: { fullName: true } } },
  });
  if (!link) return { ok: false, error: "Acompanhante não encontrado." };
  await db.reservationGuest.delete({ where: { reservationId_guestId: { reservationId, guestId } } });
  await event(db, reservationId, actor.id, "acompanhante_removido", link.guest.fullName);
  return { ok: true };
}

// Escolher (ou soltar) o quarto de uma reserva futura.
export async function assignRoom(db: Db, actor: SessionUser, id: string, roomId: string | null): Promise<Result> {
  const no = denied(actor);
  if (no) return no;
  const r = await db.reservation.findUnique({ where: { id }, select: { status: true, checkIn: true, checkOut: true, roomTypeId: true } });
  if (!r || r.status !== "CONFIRMADA") return { ok: false, error: "Só dá para escolher quarto de reserva confirmada (antes do check-in)." };

  if (!roomId) {
    await db.reservation.update({ where: { id }, data: { roomId: null } });
    await event(db, id, actor.id, "quarto", "Quarto liberado");
    return { ok: true };
  }
  const check = await checkRoomForStay(db, roomId, toDateStr(r.checkIn), toDateStr(r.checkOut), id);
  if ("error" in check) return { ok: false, error: check.error! };
  if (check.room.roomTypeId !== r.roomTypeId) {
    const busy = await ensureAvailable(db, check.room.roomTypeId, toDateStr(r.checkIn), toDateStr(r.checkOut), id);
    if (busy) return { ok: false, error: busy };
  }
  try {
    await db.reservation.update({ where: { id }, data: { roomId, roomTypeId: check.room.roomTypeId } });
  } catch (error) {
    const msg = overlapError(error);
    if (msg) return { ok: false, error: msg };
    throw error;
  }
  await event(db, id, actor.id, "quarto", `Quarto ${check.room.number}${check.room.roomTypeId !== r.roomTypeId ? " (outro tipo)" : ""}`);
  return { ok: true };
}

// ----------------------------------------------------------------
// CANCELAR / NÃO COMPARECEU
// ----------------------------------------------------------------

const reasonSchema = z.string().trim().min(3, "Diga o motivo.").max(300);

export async function cancelReservation(db: Db, actor: SessionUser, id: string, reason: unknown, noShow = false): Promise<Result> {
  const no = denied(actor);
  if (no) return no;
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const r = await db.reservation.findUnique({ where: { id }, select: { status: true, checkIn: true } });
  if (!r || r.status !== "CONFIRMADA") return { ok: false, error: "Só reservas confirmadas (antes do check-in) podem ser canceladas." };
  if (noShow && toDateStr(r.checkIn) > (await getBusinessDate(db))) {
    return { ok: false, error: "A data de entrada ainda não chegou." };
  }
  // Dinheiro do hóspede não pode ficar "perdido" numa reserva cancelada.
  const { balance } = folioTotals(await db.folioEntry.findMany({ where: { reservationId: id }, select: { kind: true, amountCents: true } }));
  if (balance < 0) {
    return {
      ok: false,
      error: `Esta reserva tem ${formatBRL(-balance)} pago (sinal). Faça a devolução na conta antes de cancelar, ou registre a multa como cobrança.`,
    };
  }

  await db.reservation.update({
    where: { id },
    data: { status: noShow ? "NO_SHOW" : "CANCELADA", cancelReason: parsed.data, roomId: null },
  });
  await event(db, id, actor.id, noShow ? "no_show" : "cancelada", parsed.data);
  await audit(db, noShow ? "reservation.no_show" : "reservation.cancelled", { userId: actor.id, metadata: { id } });
  return { ok: true };
}

// ----------------------------------------------------------------
// CHECK-IN
// ----------------------------------------------------------------

const checkInSchema = z.object({
  roomId: z.uuid("Escolha o quarto."),
  guest: guestSchema,
  vehicle: vehicleSchema.optional(),
});

export async function checkIn(db: Db, actor: SessionUser, id: string, input: unknown): Promise<Result<Rooms>> {
  const no = denied(actor);
  if (no) return no;
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { roomId, guest, vehicle } = parsed.data;

  if (!guest.docNumber) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: { docNumber: ["Documento obrigatório no check-in (ficha do hóspede)."] } };
  }

  const r = await db.reservation.findUnique({
    where: { id },
    select: { status: true, checkIn: true, checkOut: true, roomTypeId: true, guestId: true },
  });
  if (!r || r.status !== "CONFIRMADA") return { ok: false, error: "Esta reserva não está aguardando check-in." };

  const today = await getBusinessDate(db);
  const checkInDate = toDateStr(r.checkIn);
  const checkOutDate = toDateStr(r.checkOut);
  if (checkInDate > today) return { ok: false, error: `A reserva é para ${checkInDate.split("-").reverse().join("/")}. Altere a data de entrada antes do check-in.` };
  if (checkOutDate <= today) return { ok: false, error: "A data de saída já passou. Altere a reserva antes do check-in." };

  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { id: true, number: true, active: true, roomTypeId: true, occupancy: true, housekeeping: true, maintenance: true },
  });
  if (!room) return { ok: false, error: "Quarto não encontrado." };
  const notReady = roomReadyReason(room);
  if (notReady) return { ok: false, error: `Quarto ${room.number}: ${notReady}` };

  const check = await checkRoomForStay(db, roomId, checkInDate, checkOutDate, id);
  if ("error" in check) return { ok: false, error: check.error! };
  if (room.roomTypeId !== r.roomTypeId) {
    const busy = await ensureAvailable(db, room.roomTypeId, checkInDate, checkOutDate, id);
    if (busy) return { ok: false, error: busy };
  }

  await db.guest.update({ where: { id: r.guestId }, data: guestData(guest) });
  try {
    await db.reservation.update({
      where: { id },
      data: { status: "HOSPEDADA", roomId, roomTypeId: room.roomTypeId, checkedInAt: new Date() },
    });
  } catch (error) {
    const msg = overlapError(error);
    if (msg) return { ok: false, error: msg };
    throw error;
  }
  if (vehicle) await db.vehicle.create({ data: { ...vehicle, reservationId: id } });

  const updated = await applyRoomChanges(db, actor, roomId, { occupancy: "OCUPADO" });
  await event(db, id, actor.id, "checkin", `Quarto ${room.number}${vehicle ? ` · veículo ${vehicle.plate}` : ""}`);
  await audit(db, "reservation.checkin", { userId: actor.id, metadata: { id, room: room.number } });
  return { ok: true, rooms: [updated] };
}

// Hóspede sem reserva: cria e já faz o check-in.
export async function walkIn(db: Db, actor: SessionUser, input: unknown): Promise<Result<Rooms & { id: string }>> {
  const no = denied(actor);
  if (no) return no;
  const parsed = z
    .object({ stay: stayFields, guest: guestSchema, vehicle: vehicleSchema.optional() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { stay } = parsed.data;
  const today = await getBusinessDate(db);
  if (stay.checkIn !== today) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: { checkIn: ["Entrada direta é sempre na data do sistema."] } };
  }
  if (!stay.roomId) return { ok: false, error: "Revise os campos destacados.", fieldErrors: { roomId: ["Escolha o quarto."] } };

  // Repassa os dados ORIGINAIS (não os já convertidos): validar duas vezes
  // o resultado convertido mudaria valores (ex.: diária em centavos × 100).
  const raw = input as { stay: unknown; guest: unknown };
  const created = await createReservation(db, actor, { guest: raw.guest, stay: raw.stay });
  if (!created.ok) return created;
  const done = await checkIn(db, actor, created.id, {
    roomId: stay.roomId,
    guest: raw.guest,
    vehicle: (input as { vehicle?: unknown }).vehicle,
  });
  if (!done.ok) throw new Error(done.error); // desfaz a transação inteira
  return { ok: true, id: created.id, rooms: done.rooms };
}

// ----------------------------------------------------------------
// CHECK-OUT
// ----------------------------------------------------------------

export async function checkOut(db: Db, actor: SessionUser, id: string): Promise<Result<Rooms>> {
  const no = denied(actor);
  if (no) return no;
  const r = await db.reservation.findUnique({
    where: { id },
    select: { status: true, roomId: true, checkIn: true, checkOut: true, room: { select: { number: true } } },
  });
  if (!r || r.status !== "HOSPEDADA" || !r.roomId) return { ok: false, error: "Este hóspede não está na casa." };

  // A conta precisa estar fechada: diárias lançadas e saldo zero.
  const blocker = await checkoutBlocker(db, id);
  if (blocker) return { ok: false, error: blocker };

  const today = await getBusinessDate(db);
  // Saída antecipada libera as noites que não serão usadas.
  const newCheckOut = effectiveCheckOut(toDateStr(r.checkIn), toDateStr(r.checkOut), today);

  await db.reservation.update({
    where: { id },
    data: { status: "FINALIZADA", checkedOutAt: new Date(), checkOut: fromDateStr(newCheckOut) },
  });
  await db.vehicle.updateMany({ where: { reservationId: id, exitedAt: null }, data: { exitedAt: new Date() } });
  const room = await applyRoomChanges(db, actor, r.roomId, { occupancy: "LIVRE", housekeeping: "SUJO" });
  const early = newCheckOut !== toDateStr(r.checkOut) ? " (saída antecipada)" : "";
  await event(db, id, actor.id, "checkout", `Quarto ${r.room?.number}${early}`);
  await audit(db, "reservation.checkout", { userId: actor.id, metadata: { id } });
  return { ok: true, rooms: [room] };
}

// ----------------------------------------------------------------
// TROCA DE QUARTO
// ----------------------------------------------------------------

export async function moveRoom(db: Db, actor: SessionUser, id: string, toRoomId: unknown, reason: unknown): Promise<Result<Rooms>> {
  const no = denied(actor);
  if (no) return no;
  const parsedReason = reasonSchema.safeParse(reason);
  if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message };
  if (typeof toRoomId !== "string") return { ok: false, error: "Escolha o novo quarto." };

  const r = await db.reservation.findUnique({
    where: { id },
    select: { status: true, roomId: true, roomTypeId: true, checkOut: true, room: { select: { number: true } } },
  });
  if (!r || r.status !== "HOSPEDADA" || !r.roomId) return { ok: false, error: "Só dá para trocar o quarto de quem está hospedado." };
  if (r.roomId === toRoomId) return { ok: false, error: "Escolha um quarto diferente do atual." };

  const target = await db.room.findUnique({
    where: { id: toRoomId },
    select: { id: true, number: true, active: true, roomTypeId: true, occupancy: true, housekeeping: true, maintenance: true },
  });
  if (!target) return { ok: false, error: "Quarto não encontrado." };
  const notReady = roomReadyReason(target);
  if (notReady) return { ok: false, error: `Quarto ${target.number}: ${notReady}` };

  const today = await getBusinessDate(db);
  const check = await checkRoomForStay(db, toRoomId, today, toDateStr(r.checkOut), id);
  if ("error" in check) return { ok: false, error: check.error! };
  if (target.roomTypeId !== r.roomTypeId) {
    const busy = await ensureAvailable(db, target.roomTypeId, today, toDateStr(r.checkOut), id);
    if (busy) return { ok: false, error: busy };
  }

  try {
    await db.reservation.update({ where: { id }, data: { roomId: toRoomId, roomTypeId: target.roomTypeId } });
  } catch (error) {
    const msg = overlapError(error);
    if (msg) return { ok: false, error: msg };
    throw error;
  }
  await db.roomMove.create({ data: { reservationId: id, fromRoomId: r.roomId, toRoomId, reason: parsedReason.data, userId: actor.id } });
  const oldRoom = await applyRoomChanges(db, actor, r.roomId, { occupancy: "LIVRE", housekeeping: "SUJO" });
  const newRoom = await applyRoomChanges(db, actor, toRoomId, { occupancy: "OCUPADO" });
  await event(db, id, actor.id, "troca_quarto", `${r.room?.number} → ${target.number}: ${parsedReason.data}`);
  await audit(db, "reservation.room_move", { userId: actor.id, metadata: { id, from: r.room?.number, to: target.number } });
  return { ok: true, rooms: [oldRoom, newRoom] };
}

// ----------------------------------------------------------------
// GARAGEM
// ----------------------------------------------------------------

export async function addVehicle(db: Db, actor: SessionUser, reservationId: string, input: unknown): Promise<Result> {
  const no = denied(actor);
  if (no) return no;
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await db.reservation.findUnique({ where: { id: reservationId }, select: { status: true } });
  if (!r || r.status !== "HOSPEDADA") return { ok: false, error: "Só hóspedes na casa podem ter veículo na garagem." };
  const inUse = await db.vehicle.findFirst({ where: { plate: parsed.data.plate, exitedAt: null }, select: { id: true } });
  if (inUse) return { ok: false, error: "Revise os campos destacados.", fieldErrors: { plate: ["Este veículo já está na garagem."] } };
  await db.vehicle.create({ data: { ...parsed.data, reservationId } });
  await event(db, reservationId, actor.id, "veiculo", `Entrou ${parsed.data.plate}`);
  return { ok: true };
}

export async function vehicleExit(db: Db, actor: SessionUser, vehicleId: string): Promise<Result> {
  const no = denied(actor);
  if (no) return no;
  const v = await db.vehicle.findUnique({ where: { id: vehicleId }, select: { exitedAt: true, plate: true, reservationId: true } });
  if (!v || v.exitedAt) return { ok: false, error: "Veículo não está na garagem." };
  await db.vehicle.update({ where: { id: vehicleId }, data: { exitedAt: new Date() } });
  await event(db, v.reservationId, actor.id, "veiculo", `Saiu ${v.plate}`);
  return { ok: true };
}

export async function garage(db: Db) {
  const rows = await db.vehicle.findMany({
    where: { exitedAt: null },
    orderBy: { enteredAt: "asc" },
    select: {
      id: true,
      plate: true,
      model: true,
      color: true,
      spot: true,
      enteredAt: true,
      reservation: { select: { id: true, number: true, checkOut: true, guest: { select: { fullName: true } }, room: { select: { number: true } } } },
    },
  });
  return rows.map((v) => ({
    id: v.id,
    plate: v.plate,
    model: v.model,
    color: v.color,
    spot: v.spot,
    enteredAt: v.enteredAt.toISOString(),
    reservationId: v.reservation.id,
    reservationNumber: v.reservation.number,
    guestName: v.reservation.guest.fullName,
    roomNumber: v.reservation.room?.number ?? null,
    checkOut: toDateStr(v.reservation.checkOut),
  }));
}

// Quartos que podem receber hóspede agora (check-in / troca), com o tipo.
export async function readyRooms(db: Db, from: DateStr, to: DateStr, reservationId?: string) {
  const rooms = await db.room.findMany({
    where: { active: true, occupancy: "LIVRE", housekeeping: "LIMPO", maintenance: { in: ["OK", "COM_PROBLEMA"] } },
    select: { id: true, number: true, floor: true, roomTypeId: true, maintenance: true, roomType: { select: { name: true } } },
  });
  const taken = await db.reservation.findMany({
    where: {
      roomId: { in: rooms.map((r) => r.id) },
      status: { in: ACTIVE_STATUSES },
      checkIn: { lt: fromDateStr(to) },
      checkOut: { gt: fromDateStr(from) },
      ...(reservationId ? { id: { not: reservationId } } : {}),
    },
    select: { roomId: true },
  });
  const takenIds = new Set(taken.map((t) => t.roomId));
  return rooms
    .filter((r) => !takenIds.has(r.id))
    .map((r) => ({ id: r.id, number: r.number, floor: r.floor, roomTypeId: r.roomTypeId, typeName: r.roomType.name, problem: r.maintenance === "COM_PROBLEMA" }))
    .sort((a, b) => a.number.localeCompare(b.number, "pt-BR", { numeric: true }));
}
