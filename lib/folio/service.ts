import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { fieldErrors } from "@/lib/auth/validation";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { formatDate, fromDateStr, localToday, toDateStr, type DateStr } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getBusinessDate } from "@/lib/hotel-date";
import { getParkingDailyCents } from "@/lib/settings";
import {
  CATEGORY_LABEL,
  chargeSchema,
  effectiveCheckOut,
  folioTotals,
  issFor,
  METHOD,
  nightsToPost,
  paymentSchema,
  refundSchema,
  reverseSchema,
  vehicleOnNight,
  type Category,
  type Method,
} from "@/lib/folio/rules";

// ================================================================
// CONTA DO QUARTO
// ================================================================

type Result<T = object> = ({ ok: true } & T) | Failure;

export type FolioEntryView = {
  id: string;
  kind: "COBRANCA" | "PAGAMENTO";
  category: Category | null;
  method: Method | null;
  description: string;
  quantity: number;
  unitCents: number | null;
  amountCents: number;
  nightDate: DateStr | null;
  reference: string | null;
  installments: number | null;
  isRefund: boolean;
  businessDate: DateStr;
  createdAt: string;
  createdByName: string;
  reversalOfId: string | null;
  reversedAt: string | null;
  reversedByName: string | null;
  reverseReason: string | null;
};

export type FolioView = {
  entries: FolioEntryView[];
  charges: number;
  payments: number;
  balance: number;
  // Noites já vencidas e ainda não lançadas (antes de hoje).
  pendingNights: DateStr[];
  // Noites que faltam para FECHAR a conta se o hóspede sair hoje.
  checkoutNights: DateStr[];
  checkoutPreview: number; // valor das noites que faltam (diária + ISS + garagem)
  parkingDailyCents: number;
};

const entrySelect = {
  id: true,
  kind: true,
  category: true,
  method: true,
  description: true,
  quantity: true,
  unitCents: true,
  amountCents: true,
  nightDate: true,
  reference: true,
  installments: true,
  isRefund: true,
  businessDate: true,
  createdAt: true,
  reversalOfId: true,
  reversedAt: true,
  reverseReason: true,
  createdBy: { select: { fullName: true } },
  reversedBy: { select: { fullName: true } },
} as const;

type EntryRow = Awaited<ReturnType<typeof loadEntries>>[number];

function loadEntries(db: Db, reservationId: string) {
  return db.folioEntry.findMany({ where: { reservationId }, select: entrySelect, orderBy: { createdAt: "asc" } });
}

function toView(e: EntryRow): FolioEntryView {
  return {
    id: e.id,
    kind: e.kind,
    category: e.category,
    method: e.method,
    description: e.description,
    quantity: e.quantity,
    unitCents: e.unitCents,
    amountCents: e.amountCents,
    nightDate: e.nightDate ? toDateStr(e.nightDate) : null,
    reference: e.reference,
    installments: e.installments,
    isRefund: e.isRefund,
    businessDate: toDateStr(e.businessDate),
    createdAt: e.createdAt.toISOString(),
    createdByName: e.createdBy?.fullName ?? "Sistema",
    reversalOfId: e.reversalOfId,
    reversedAt: e.reversedAt?.toISOString() ?? null,
    reversedByName: e.reversedBy?.fullName ?? null,
    reverseReason: e.reverseReason,
  };
}

// Noites com diária ativa (lançada e não estornada).
function postedNights(entries: EntryRow[]): Set<DateStr> {
  return new Set(
    entries.filter((e) => e.category === "DIARIA" && e.nightDate && !e.reversalOfId && !e.reversedAt).map((e) => toDateStr(e.nightDate!))
  );
}

async function stayInfo(db: Db, reservationId: string) {
  return db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      number: true,
      status: true,
      checkIn: true,
      checkOut: true,
      dailyCents: true,
      chargeIss: true,
      issBasisPoints: true,
      vehicles: { select: { plate: true, enteredAt: true, exitedAt: true } },
    },
  });
}

type Stay = NonNullable<Awaited<ReturnType<typeof stayInfo>>>;

// O que seria lançado para cada noite.
function nightCharges(stay: Stay, night: DateStr, parkingDaily: number) {
  const list: { category: Category; description: string; amountCents: number }[] = [
    { category: "DIARIA", description: `Diária ${formatDate(night)}`, amountCents: stay.dailyCents },
  ];
  const iss = issFor(stay.dailyCents, stay.chargeIss, stay.issBasisPoints);
  if (iss > 0) list.push({ category: "ISS", description: `ISS sobre diária ${formatDate(night)}`, amountCents: iss });
  if (parkingDaily > 0) {
    const cars = stay.vehicles.filter((v) => vehicleOnNight(localToday(v.enteredAt), v.exitedAt ? localToday(v.exitedAt) : null, night));
    for (const v of cars) {
      list.push({ category: "ESTACIONAMENTO", description: `Estacionamento ${v.plate} ${formatDate(night)}`, amountCents: parkingDaily });
    }
  }
  return list.filter((c) => c.amountCents > 0);
}

export async function getFolio(db: Db, reservationId: string): Promise<FolioView | null> {
  const [stay, rows, today, parkingDaily] = await Promise.all([
    stayInfo(db, reservationId),
    loadEntries(db, reservationId),
    getBusinessDate(db),
    getParkingDailyCents(db),
  ]);
  if (!stay) return null;

  const totals = folioTotals(rows);
  const posted = postedNights(rows);
  const checkIn = toDateStr(stay.checkIn);
  const checkOut = toDateStr(stay.checkOut);
  const inHouse = stay.status === "HOSPEDADA";

  const pendingNights = inHouse ? nightsToPost(checkIn, checkOut < today ? checkOut : today, posted) : [];
  const checkoutNights = inHouse ? nightsToPost(checkIn, effectiveCheckOut(checkIn, checkOut, today), posted) : [];
  const checkoutPreview = checkoutNights
    .flatMap((n) => nightCharges(stay, n, parkingDaily))
    .reduce((s, c) => s + c.amountCents, 0);

  return { entries: rows.map(toView), ...totals, pendingNights, checkoutNights, checkoutPreview, parkingDailyCents: parkingDaily };
}

// ----------------------------------------------------------------
// LANÇAR DIÁRIAS
// ----------------------------------------------------------------

// Lança diária (+ ISS + estacionamento) de cada noite que falta até
// "until" (exclusive). Usado na recepção, no check-out e, na Fase 6,
// pela auditoria noturna. actor null = sistema.
export async function postNights(db: Db, actor: { id: string } | null, reservationId: string, until: DateStr) {
  const [stay, rows, today, parkingDaily] = await Promise.all([
    stayInfo(db, reservationId),
    loadEntries(db, reservationId),
    getBusinessDate(db),
    getParkingDailyCents(db),
  ]);
  if (!stay || stay.status !== "HOSPEDADA") return { nights: [] as DateStr[], total: 0 };

  const nights = nightsToPost(toDateStr(stay.checkIn), until, postedNights(rows));
  let total = 0;
  for (const night of nights) {
    for (const c of nightCharges(stay, night, parkingDaily)) {
      await db.folioEntry.create({
        data: {
          reservationId,
          kind: "COBRANCA",
          category: c.category,
          description: c.description,
          unitCents: c.amountCents,
          amountCents: c.amountCents,
          nightDate: fromDateStr(night),
          businessDate: fromDateStr(today),
          createdById: actor?.id ?? null,
        },
      });
      total += c.amountCents;
    }
  }
  return { nights, total };
}

function denied(actor: SessionUser, permission: "finance.post" | "finance.reverse"): Failure | null {
  return can(actor.role, permission) ? null : { ok: false, error: "Seu cargo não pode fazer lançamentos na conta." };
}

async function event(db: Db, reservationId: string, userId: string, type: string, message: string) {
  await db.reservationEvent.create({ data: { reservationId, userId, type, message } });
}

export async function postPendingNights(db: Db, actor: SessionUser, reservationId: string, forCheckout: boolean): Promise<Result<{ count: number }>> {
  const no = denied(actor, "finance.post");
  if (no) return no;
  const stay = await stayInfo(db, reservationId);
  if (!stay || stay.status !== "HOSPEDADA") return { ok: false, error: "Só hóspedes na casa têm diárias a lançar." };
  const today = await getBusinessDate(db);
  const checkIn = toDateStr(stay.checkIn);
  const checkOut = toDateStr(stay.checkOut);
  const until = forCheckout ? effectiveCheckOut(checkIn, checkOut, today) : checkOut < today ? checkOut : today;
  const { nights, total } = await postNights(db, actor, reservationId, until);
  if (nights.length === 0) return { ok: false, error: "Não há diárias pendentes." };
  await event(db, reservationId, actor.id, "conta", `${nights.length} diária(s) lançada(s): ${formatBRL(total)}`);
  return { ok: true, count: nights.length };
}

// Lança uma cobrança vinda de outro setor (restaurante, frigobar) numa
// conta de hóspede NA CASA. Quem chama já conferiu a permissão.
export async function postOutletCharge(
  db: Db,
  actorId: string,
  reservationId: string,
  charge: { category: Category; description: string; quantity: number; unitCents: number }
): Promise<string | null> {
  const r = await db.reservation.findUnique({ where: { id: reservationId }, select: { status: true } });
  if (!r || r.status !== "HOSPEDADA") return "Só dá para lançar na conta de um hóspede que está na casa.";
  const amount = charge.quantity * charge.unitCents;
  if (amount <= 0) return null;
  await db.folioEntry.create({
    data: {
      reservationId,
      kind: "COBRANCA",
      category: charge.category,
      description: charge.description,
      quantity: charge.quantity,
      unitCents: charge.unitCents,
      amountCents: amount,
      businessDate: fromDateStr(await getBusinessDate(db)),
      createdById: actorId,
    },
  });
  return null;
}

// ----------------------------------------------------------------
// COBRANÇAS E PAGAMENTOS
// ----------------------------------------------------------------

async function openFolio(db: Db, reservationId: string, allowConfirmed: boolean) {
  const r = await db.reservation.findUnique({ where: { id: reservationId }, select: { status: true } });
  if (!r) return "Reserva não encontrada.";
  if (r.status === "HOSPEDADA") return null;
  if (allowConfirmed && r.status === "CONFIRMADA") return null;
  return r.status === "CONFIRMADA" ? "Cobranças só depois do check-in." : "Conta encerrada: esta reserva já foi finalizada ou cancelada.";
}

export async function addCharge(db: Db, actor: SessionUser, reservationId: string, input: unknown): Promise<Result> {
  const no = denied(actor, "finance.post");
  if (no) return no;
  const parsed = chargeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  // Antes do check-in também vale (ex.: multa de cancelamento descontada do sinal).
  const closed = await openFolio(db, reservationId, true);
  if (closed) return { ok: false, error: closed };

  const { category, description, quantity, unit } = parsed.data;
  const amount = quantity * unit;
  await db.folioEntry.create({
    data: {
      reservationId,
      kind: "COBRANCA",
      category,
      description,
      quantity,
      unitCents: unit,
      amountCents: amount,
      businessDate: fromDateStr(await getBusinessDate(db)),
      createdById: actor.id,
    },
  });
  await event(db, reservationId, actor.id, "conta", `Cobrança ${CATEGORY_LABEL[category]}: ${description} ${formatBRL(amount)}`);
  await audit(db, "folio.charge", { userId: actor.id, metadata: { reservationId, category, amount } });
  return { ok: true };
}

// Pagamento: aceito também ANTES do check-in (sinal / pré-pagamento).
export async function addPayment(db: Db, actor: SessionUser, reservationId: string, input: unknown): Promise<Result> {
  const no = denied(actor, "finance.post");
  if (no) return no;
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const closed = await openFolio(db, reservationId, true);
  if (closed) return { ok: false, error: closed };

  const { method, amount, reference, installments } = parsed.data;
  if ((method === "CREDITO" || method === "DEBITO") && reference && /\d{12,}/.test(reference.replace(/\D/g, ""))) {
    // Proteção: nunca guardar número de cartão.
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: { reference: ["Não digite o número do cartão. Use só o NSU ou o código de autorização."] } };
  }
  await db.folioEntry.create({
    data: {
      reservationId,
      kind: "PAGAMENTO",
      method,
      description: `Pagamento ${METHOD[method].label}${method === "CREDITO" && installments && installments > 1 ? ` em ${installments}x` : ""}`,
      amountCents: amount,
      reference,
      installments: method === "CREDITO" ? (installments ?? 1) : null,
      businessDate: fromDateStr(await getBusinessDate(db)),
      createdById: actor.id,
    },
  });
  await event(db, reservationId, actor.id, "conta", `Pagamento ${METHOD[method].label}: ${formatBRL(amount)}`);
  await audit(db, "folio.payment", { userId: actor.id, metadata: { reservationId, method, amount } });
  return { ok: true };
}

// Devolver crédito ao hóspede (pagou a mais).
export async function refund(db: Db, actor: SessionUser, reservationId: string, input: unknown): Promise<Result> {
  const no = denied(actor, "finance.post");
  if (no) return no;
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const r = await db.reservation.findUnique({ where: { id: reservationId }, select: { status: true } });
  if (!r || r.status === "FINALIZADA") return { ok: false, error: "Conta encerrada." };

  const { balance } = folioTotals(await loadEntries(db, reservationId));
  const credit = -balance;
  if (parsed.data.amount > credit) {
    return { ok: false, error: credit > 0 ? `O hóspede tem só ${formatBRL(credit)} de crédito.` : "O hóspede não tem crédito para devolver." };
  }
  await db.folioEntry.create({
    data: {
      reservationId,
      kind: "PAGAMENTO",
      method: parsed.data.method,
      description: `Devolução ao hóspede (${METHOD[parsed.data.method].label}): ${parsed.data.reason}`,
      amountCents: -parsed.data.amount,
      isRefund: true,
      businessDate: fromDateStr(await getBusinessDate(db)),
      createdById: actor.id,
    },
  });
  await event(db, reservationId, actor.id, "conta", `Devolução ${formatBRL(parsed.data.amount)}: ${parsed.data.reason}`);
  await audit(db, "folio.refund", { userId: actor.id, metadata: { reservationId, amount: parsed.data.amount } });
  return { ok: true };
}

// ----------------------------------------------------------------
// ESTORNO
// ----------------------------------------------------------------

export async function reverseEntry(db: Db, actor: SessionUser, entryId: string, reason: unknown): Promise<Result<{ reservationId: string }>> {
  const no = denied(actor, "finance.reverse");
  if (no) return { ok: false, error: "Só gerente ou administrador pode estornar." };
  const parsed = reverseSchema.safeParse(reason);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const e = await db.folioEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      reservationId: true,
      kind: true,
      category: true,
      method: true,
      description: true,
      amountCents: true,
      nightDate: true,
      reversalOfId: true,
      reversedAt: true,
      isRefund: true,
      reservation: { select: { status: true } },
    },
  });
  if (!e) return { ok: false, error: "Lançamento não encontrado." };
  if (e.reversalOfId) return { ok: false, error: "Isto já é um estorno; não se estorna um estorno." };
  if (e.reversedAt) return { ok: false, error: "Este lançamento já foi estornado." };
  if (e.reservation.status === "FINALIZADA" || e.reservation.status === "CANCELADA" || e.reservation.status === "NO_SHOW") {
    return { ok: false, error: "Conta encerrada: não dá para estornar depois do check-out." };
  }

  const now = new Date();
  await db.folioEntry.update({
    where: { id: e.id },
    data: { reversedAt: now, reversedById: actor.id, reverseReason: parsed.data },
  });
  await db.folioEntry.create({
    data: {
      reservationId: e.reservationId,
      kind: e.kind,
      category: e.category,
      method: e.method,
      description: `Estorno: ${e.description}`,
      amountCents: -e.amountCents,
      nightDate: e.nightDate,
      isRefund: e.isRefund,
      reversalOfId: e.id,
      reversedAt: null,
      businessDate: fromDateStr(await getBusinessDate(db)),
      createdById: actor.id,
    },
  });
  await event(db, e.reservationId, actor.id, "estorno", `${e.description} (${formatBRL(e.amountCents)}): ${parsed.data}`);
  await audit(db, "folio.reverse", { userId: actor.id, metadata: { entryId, amount: e.amountCents, reason: parsed.data } });
  return { ok: true, reservationId: e.reservationId };
}

// ----------------------------------------------------------------
// FECHAMENTO NO CHECK-OUT
// ----------------------------------------------------------------

// Motivo para não deixar fazer o check-out, ou null se a conta fechou.
export async function checkoutBlocker(db: Db, reservationId: string): Promise<string | null> {
  const folio = await getFolio(db, reservationId);
  if (!folio) return "Reserva não encontrada.";
  const openTab = await db.comanda.findFirst({ where: { reservationId, status: "ABERTA" }, select: { number: true } });
  if (openTab) return `O hóspede tem a comanda nº ${openTab.number} aberta no restaurante. Feche-a (no quarto ou paga) antes do check-out.`;
  if (folio.checkoutNights.length > 0) {
    return `Faltam lançar ${folio.checkoutNights.length} diária(s) (${formatBRL(folio.checkoutPreview)}). Use "Fechar a conta" antes do check-out.`;
  }
  if (folio.balance > 0) return `A conta tem ${formatBRL(folio.balance)} a pagar. Receba o pagamento antes do check-out.`;
  if (folio.balance < 0) return `O hóspede tem ${formatBRL(-folio.balance)} de crédito. Faça a devolução antes do check-out.`;
  return null;
}

// ----------------------------------------------------------------
// FINANCEIRO (borderô do dia e contas abertas)
// ----------------------------------------------------------------

export async function dailyReport(db: Db, date: DateStr) {
  const rows = await db.folioEntry.findMany({
    where: { businessDate: fromDateStr(date) },
    orderBy: { createdAt: "asc" },
    select: {
      ...entrySelect,
      reservation: { select: { id: true, number: true, guest: { select: { fullName: true } }, room: { select: { number: true } } } },
    },
  });

  const byMethod = Object.fromEntries((Object.keys(METHOD) as Method[]).map((m) => [m, 0])) as Record<Method, number>;
  const byCategory: Partial<Record<Category, number>> = {};
  for (const r of rows) {
    if (r.kind === "PAGAMENTO" && r.method) byMethod[r.method] += r.amountCents;
    if (r.kind === "COBRANCA" && r.category) byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amountCents;
  }

  return {
    date,
    byMethod,
    byCategory,
    totalReceived: Object.values(byMethod).reduce((s, v) => s + v, 0),
    totalCharged: Object.values(byCategory).reduce((s, v) => s + (v ?? 0), 0),
    entries: rows.map((r) => ({
      ...toView(r),
      reservationId: r.reservation.id,
      reservationNumber: r.reservation.number,
      guestName: r.reservation.guest.fullName,
      roomNumber: r.reservation.room?.number ?? null,
    })),
  };
}

export async function openAccounts(db: Db) {
  const today = await getBusinessDate(db);
  const list = await db.reservation.findMany({
    where: { status: "HOSPEDADA" },
    select: {
      id: true,
      number: true,
      checkIn: true,
      checkOut: true,
      guest: { select: { fullName: true } },
      room: { select: { number: true } },
      folio: { select: { kind: true, amountCents: true, category: true, nightDate: true, reversalOfId: true, reversedAt: true } },
    },
  });
  return list
    .map((r) => {
      const t = folioTotals(r.folio);
      const posted = new Set(
        r.folio.filter((e) => e.category === "DIARIA" && e.nightDate && !e.reversalOfId && !e.reversedAt).map((e) => toDateStr(e.nightDate!))
      );
      const checkOut = toDateStr(r.checkOut);
      return {
        id: r.id,
        number: r.number,
        guestName: r.guest.fullName,
        roomNumber: r.room?.number ?? null,
        checkOut,
        balance: t.balance,
        pendingNights: nightsToPost(toDateStr(r.checkIn), checkOut < today ? checkOut : today, posted).length,
      };
    })
    .sort((a, b) => b.balance - a.balance);
}
