import { z } from "zod";
import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { fieldErrors } from "@/lib/auth/validation";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { fromDateStr, toDateStr, type DateStr } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getBusinessDate } from "@/lib/hotel-date";
import { checkPaymentChoice } from "@/lib/settings";
import { METHOD, folioTotals, paymentSchema, type Method } from "@/lib/folio/rules";

// ================================================================
// CONTAS PENDENTES
// O hóspede sai devendo parte da conta (ex.: frigobar). As cobranças
// escolhidas viram uma conta pendente; o quarto pode ser liberado.
// ================================================================

type Result<T = object> = ({ ok: true } & T) | Failure;

export type PendingItem = { entryId?: string; description: string; amountCents: number };

const sendSchema = z.object({
  entryIds: z.array(z.uuid()).min(1, "Marque as cobranças que ficam pendentes."),
  reason: z.string().trim().min(5, "Explique por que a conta fica pendente (ex.: hóspede vai pagar por Pix amanhã).").max(300),
});

// Separa cobranças da conta do quarto numa conta pendente.
export async function sendToPending(db: Db, actor: SessionUser, reservationId: string, input: unknown): Promise<Result<{ number: number }>> {
  if (!can(actor.role, "finance.post")) return { ok: false, error: "Seu cargo não pode fazer lançamentos na conta." };
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const { entryIds, reason } = parsed.data;

  const r = await db.reservation.findUnique({
    where: { id: reservationId },
    select: { status: true, guestId: true, folio: { select: { id: true, kind: true, amountCents: true, description: true, reversalOfId: true, reversedAt: true } } },
  });
  if (!r) return { ok: false, error: "Reserva não encontrada." };
  if (r.status !== "HOSPEDADA") return { ok: false, error: "Só dá para deixar conta pendente com o hóspede ainda na casa (antes de confirmar o check-out)." };

  const already = new Set(await pendingEntryIds(db, reservationId));
  if (entryIds.some((id) => already.has(id))) return { ok: false, error: "Alguma dessas cobranças já está numa conta pendente." };
  const chosen = r.folio.filter((e) => entryIds.includes(e.id));
  if (chosen.length !== entryIds.length || chosen.some((e) => e.kind !== "COBRANCA" || e.reversalOfId || e.reversedAt || e.amountCents <= 0)) {
    return { ok: false, error: "Escolha só cobranças ativas desta conta." };
  }
  const balance = folioTotals(r.folio).balance;
  if (balance <= 0) return { ok: false, error: "A conta não tem saldo a pagar." };
  // Se o hóspede já pagou parte, só o que falta pode ficar pendente.
  const selected = chosen.reduce((s, e) => s + e.amountCents, 0);
  const amount = Math.min(selected, balance);
  const items: PendingItem[] = chosen.map((e) => ({ entryId: e.id, description: e.description, amountCents: e.amountCents }));

  const today = fromDateStr(await getBusinessDate(db));
  const p = await db.pendingAccount.create({
    data: { reservationId, guestId: r.guestId, amountCents: amount, items, reason, businessDate: today, createdById: actor.id },
    select: { id: true, number: true },
  });
  await db.folioEntry.create({
    data: {
      reservationId,
      kind: "PENDENTE",
      description: `Conta pendente nº ${p.number}`,
      amountCents: amount,
      reference: p.id,
      businessDate: today,
      createdById: actor.id,
    },
  });
  await db.reservationEvent.create({
    data: { reservationId, userId: actor.id, type: "pendente", message: `Conta pendente nº ${p.number}: ${formatBRL(amount)} — ${reason}` },
  });
  await audit(db, "pending.created", { userId: actor.id, metadata: { reservationId, number: p.number, amount } });
  return { ok: true, number: p.number };
}

// Cobranças desta reserva que já foram para alguma conta pendente.
export async function pendingEntryIds(db: Db, reservationId: string): Promise<string[]> {
  const rows = await db.pendingAccount.findMany({ where: { reservationId }, select: { items: true } });
  return rows.flatMap((r) => ((r.items as PendingItem[]) ?? []).map((i) => i.entryId).filter((x): x is string => Boolean(x)));
}

// ---------------------------------------------------------------- consulta

export type PendingView = {
  id: string;
  number: number;
  status: "ABERTA" | "QUITADA" | "BAIXADA";
  amountCents: number;
  paidCents: number;
  remainingCents: number;
  items: PendingItem[];
  reason: string;
  businessDate: DateStr;
  createdByName: string | null;
  closedAt: string | null;
  closedByName: string | null;
  closeReason: string | null;
  reservation: { id: string; number: number; roomNumber: string | null; checkIn: DateStr; checkOut: DateStr };
  guest: { id: string; fullName: string; phone: string | null; email: string | null; docNumber: string | null };
  payments: { id: string; method: Method; cardBrand: string | null; amountCents: number; reference: string | null; businessDate: DateStr; userName: string | null }[];
};

const select = {
  id: true,
  number: true,
  status: true,
  amountCents: true,
  items: true,
  reason: true,
  businessDate: true,
  closedAt: true,
  closeReason: true,
  createdBy: { select: { fullName: true } },
  closedBy: { select: { fullName: true } },
  reservation: { select: { id: true, number: true, checkIn: true, checkOut: true, room: { select: { number: true } } } },
  guest: { select: { id: true, fullName: true, phone: true, email: true, docNumber: true } },
  payments: {
    orderBy: { createdAt: "asc" as const },
    select: { id: true, method: true, cardBrand: true, amountCents: true, reference: true, businessDate: true, createdBy: { select: { fullName: true } } },
  },
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof findOne>>>;
function findOne(db: Db, id: string) {
  return db.pendingAccount.findUnique({ where: { id }, select });
}

function toView(p: Row): PendingView {
  const paid = p.payments.reduce((s, x) => s + x.amountCents, 0);
  return {
    id: p.id,
    number: p.number,
    status: p.status,
    amountCents: p.amountCents,
    paidCents: paid,
    remainingCents: p.status === "ABERTA" ? p.amountCents - paid : 0,
    items: (p.items as PendingItem[]) ?? [],
    reason: p.reason,
    businessDate: toDateStr(p.businessDate),
    createdByName: p.createdBy?.fullName ?? null,
    closedAt: p.closedAt?.toISOString() ?? null,
    closedByName: p.closedBy?.fullName ?? null,
    closeReason: p.closeReason,
    reservation: {
      id: p.reservation.id,
      number: p.reservation.number,
      roomNumber: p.reservation.room?.number ?? null,
      checkIn: toDateStr(p.reservation.checkIn),
      checkOut: toDateStr(p.reservation.checkOut),
    },
    guest: p.guest,
    payments: p.payments.map((x) => ({
      id: x.id,
      method: x.method,
      cardBrand: x.cardBrand,
      amountCents: x.amountCents,
      reference: x.reference,
      businessDate: toDateStr(x.businessDate),
      userName: x.createdBy?.fullName ?? null,
    })),
  };
}

export async function listPending(db: Db, status: "ABERTA" | "TODAS" = "ABERTA"): Promise<PendingView[]> {
  const rows = await db.pendingAccount.findMany({
    where: status === "ABERTA" ? { status: "ABERTA" } : {},
    orderBy: { number: "desc" },
    take: 300,
    select,
  });
  return rows.map(toView);
}

export async function getPending(db: Db, id: string): Promise<PendingView | null> {
  const p = await findOne(db, id);
  return p ? toView(p) : null;
}

// Pendências em aberto de um hóspede (aviso na reserva e no check-in).
export async function openPendingForGuest(db: Db, guestId: string) {
  const rows = await db.pendingAccount.findMany({ where: { guestId, status: "ABERTA" }, select });
  return rows.map(toView).map((p) => ({ id: p.id, number: p.number, remainingCents: p.remainingCents }));
}

// ---------------------------------------------------------------- receber / baixar

export async function receivePending(db: Db, actor: SessionUser, id: string, input: unknown): Promise<Result<{ settled: boolean }>> {
  if (!can(actor.role, "finance.post")) return { ok: false, error: "Seu cargo não pode receber pagamentos." };
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const { method, amount, reference, cardBrand } = parsed.data;
  const choice = await checkPaymentChoice(db, method, cardBrand);
  if (choice) return { ok: false, error: choice };
  if (reference && /\d{12,}/.test(reference.replace(/\D/g, ""))) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: { reference: ["Não digite o número do cartão. Use só o NSU ou o código de autorização."] } };
  }

  // Um recebimento por vez na mesma conta.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"pending:" + id}))`;
  const p = await findOne(db, id);
  if (!p) return { ok: false, error: "Conta pendente não encontrada." };
  if (p.status !== "ABERTA") return { ok: false, error: "Esta conta pendente já foi encerrada." };
  const view = toView(p);
  if (amount > view.remainingCents) return { ok: false, error: `O valor passa do que falta (${formatBRL(view.remainingCents)}).` };

  const isCard = method === "CREDITO" || method === "DEBITO";
  await db.pendingPayment.create({
    data: {
      pendingAccountId: id,
      method,
      cardBrand: isCard ? cardBrand : null,
      amountCents: amount,
      reference,
      businessDate: fromDateStr(await getBusinessDate(db)),
      createdById: actor.id,
    },
  });
  const settled = amount === view.remainingCents;
  if (settled) await db.pendingAccount.update({ where: { id }, data: { status: "QUITADA", closedAt: new Date(), closedById: actor.id } });
  await db.reservationEvent.create({
    data: {
      reservationId: p.reservation.id,
      userId: actor.id,
      type: "pendente",
      message: `Conta pendente nº ${p.number}: recebido ${formatBRL(amount)} (${METHOD[method].label})${settled ? " — quitada" : ""}`,
    },
  });
  await audit(db, "pending.payment", { userId: actor.id, metadata: { id, method, amount, settled } });
  return { ok: true, settled };
}

const writeOffSchema = z.string().trim().min(5, "Explique por que a conta não será cobrada.").max(300);

// Perda: o hotel desiste de cobrar (só gerente/admin).
export async function writeOffPending(db: Db, actor: SessionUser, id: string, reason: unknown): Promise<Result> {
  if (!can(actor.role, "finance.reverse")) return { ok: false, error: "Só gerente ou administrador pode dar baixa em conta pendente." };
  const parsed = writeOffSchema.safeParse(reason);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const p = await findOne(db, id);
  if (!p) return { ok: false, error: "Conta pendente não encontrada." };
  if (p.status !== "ABERTA") return { ok: false, error: "Esta conta pendente já foi encerrada." };
  const view = toView(p);
  await db.pendingAccount.update({ where: { id }, data: { status: "BAIXADA", closedAt: new Date(), closedById: actor.id, closeReason: parsed.data } });
  await db.reservationEvent.create({
    data: { reservationId: p.reservation.id, userId: actor.id, type: "pendente", message: `Conta pendente nº ${p.number}: baixa de ${formatBRL(view.remainingCents)} — ${parsed.data}` },
  });
  await audit(db, "pending.writeoff", { userId: actor.id, metadata: { id, amount: view.remainingCents } });
  return { ok: true };
}

// Recebido de contas pendentes num dia (entra no borderô do dia).
export async function pendingPaymentsByDay(db: Db, date: DateStr) {
  const rows = await db.pendingPayment.findMany({ where: { businessDate: fromDateStr(date) }, select: { method: true, amountCents: true } });
  const byMethod = Object.fromEntries((Object.keys(METHOD) as Method[]).map((m) => [m, 0])) as Record<Method, number>;
  for (const r of rows) byMethod[r.method as Method] += r.amountCents;
  return { byMethod, total: rows.reduce((s, r) => s + r.amountCents, 0) };
}
