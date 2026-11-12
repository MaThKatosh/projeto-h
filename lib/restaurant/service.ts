import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { fieldErrors } from "@/lib/auth/validation";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { fromDateStr } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getBusinessDate } from "@/lib/hotel-date";
import { postOutletCharge } from "@/lib/folio/service";
import { METHOD, type Method } from "@/lib/folio/rules";
import {
  comandaTotals,
  menuItemSchema,
  openComandaSchema,
  orderSchema,
  posPaymentSchema,
  reasonSchema,
  tableSchema,
  type ItemStatus,
} from "@/lib/restaurant/rules";

// ================================================================
// RESTAURANTE: mesas, comandas, pedidos, cozinha
// ================================================================

type Result<T = object> = ({ ok: true } & T) | Failure;

function denied(actor: SessionUser, p: "restaurant.use" | "restaurant.cancel" | "kitchen.view" | "menu.manage"): Failure | null {
  return can(actor.role, p) ? null : { ok: false, error: "Seu cargo não pode fazer isso." };
}

async function getServiceFeeBp(db: Db) {
  const row = await db.setting.findUnique({ where: { key: "restaurantServiceBp" } });
  const n = Number(row?.value ?? 1000);
  return Number.isInteger(n) && n >= 0 ? n : 1000;
}

export async function setServiceFeeBp(db: Db, actor: SessionUser, percent: unknown): Promise<Result> {
  const no = denied(actor, "menu.manage");
  if (no) return no;
  const p = Number(String(percent).replace(",", "."));
  if (!Number.isFinite(p) || p < 0 || p > 30) return { ok: false, error: "Taxa inválida (0 a 30%)." };
  const bp = Math.round(p * 100);
  await db.setting.upsert({ where: { key: "restaurantServiceBp" }, create: { key: "restaurantServiceBp", value: bp }, update: { value: bp } });
  return { ok: true };
}

// ----------------------------------------------------------------
// LEITURA
// ----------------------------------------------------------------

const comandaSelect = {
  id: true,
  number: true,
  status: true,
  people: true,
  customerName: true,
  serviceFee: true,
  serviceFeeBp: true,
  settlement: true,
  totalCents: true,
  openedAt: true,
  closedAt: true,
  cancelReason: true,
  table: { select: { id: true, name: true } },
  reservation: { select: { id: true, number: true, status: true, guest: { select: { fullName: true } }, room: { select: { number: true } } } },
  openedBy: { select: { fullName: true } },
  items: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      name: true,
      unitCents: true,
      quantity: true,
      notes: true,
      kitchen: true,
      status: true,
      cancelReason: true,
      createdAt: true,
      readyAt: true,
      createdBy: { select: { fullName: true } },
    },
  },
  payments: { orderBy: { createdAt: "asc" as const }, select: { id: true, method: true, amountCents: true, reference: true, createdAt: true } },
} as const;

type ComandaRow = NonNullable<Awaited<ReturnType<typeof findComanda>>>;

function findComanda(db: Db, id: string) {
  return db.comanda.findUnique({ where: { id }, select: comandaSelect });
}

function toView(c: ComandaRow) {
  const paid = c.payments.reduce((s, p) => s + p.amountCents, 0);
  return {
    id: c.id,
    number: c.number,
    status: c.status,
    people: c.people,
    customerName: c.customerName,
    serviceFee: c.serviceFee,
    serviceFeeBp: c.serviceFeeBp,
    settlement: c.settlement,
    totalCents: c.totalCents,
    openedAt: c.openedAt.toISOString(),
    closedAt: c.closedAt?.toISOString() ?? null,
    cancelReason: c.cancelReason,
    tableId: c.table?.id ?? null,
    tableName: c.table?.name ?? null,
    openedByName: c.openedBy?.fullName ?? null,
    guest: c.reservation
      ? { reservationId: c.reservation.id, number: c.reservation.number, name: c.reservation.guest.fullName, room: c.reservation.room?.number ?? null, inHouse: c.reservation.status === "HOSPEDADA" }
      : null,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      unitCents: i.unitCents,
      quantity: i.quantity,
      notes: i.notes,
      kitchen: i.kitchen,
      status: i.status as ItemStatus,
      cancelReason: i.cancelReason,
      createdAt: i.createdAt.toISOString(),
      createdByName: i.createdBy?.fullName ?? null,
    })),
    payments: c.payments.map((p) => ({ ...p, method: p.method as Method, createdAt: p.createdAt.toISOString() })),
    totals: comandaTotals(c.items as { unitCents: number; quantity: number; status: ItemStatus }[], c.serviceFee, c.serviceFeeBp, paid),
  };
}

export type ComandaView = ReturnType<typeof toView>;

export async function getComanda(db: Db, id: string) {
  const c = await findComanda(db, id);
  return c ? toView(c) : null;
}

export async function restaurantBoard(db: Db, now = new Date()) {
  const [tables, open] = await Promise.all([
    db.diningTable.findMany({ where: { active: true }, select: { id: true, name: true, seats: true } }),
    db.comanda.findMany({ where: { status: "ABERTA" }, select: comandaSelect, orderBy: { openedAt: "asc" } }),
  ]);
  tables.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  return { tables, open: open.map(toView), generatedAt: now.getTime() };
}

// Hóspedes na casa (para lançar no quarto / serviço de quarto).
export async function inHouseGuests(db: Db) {
  const rows = await db.reservation.findMany({
    where: { status: "HOSPEDADA" },
    select: { id: true, number: true, guest: { select: { fullName: true } }, room: { select: { number: true } } },
  });
  return rows
    .map((r) => ({ reservationId: r.id, number: r.number, name: r.guest.fullName, room: r.room?.number ?? "" }))
    .sort((a, b) => a.room.localeCompare(b.room, "pt-BR", { numeric: true }));
}

export async function listMenu(db: Db, outlet: "RESTAURANTE" | "FRIGOBAR", activeOnly = true) {
  return db.menuItem.findMany({
    where: { outlet, ...(activeOnly ? { active: true } : {}) },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, outlet: true, name: true, group: true, priceCents: true, kitchen: true, active: true },
  });
}

export async function kitchenQueue(db: Db) {
  const items = await db.comandaItem.findMany({
    where: { kitchen: true, status: { in: ["PENDENTE", "PRONTO"] }, comanda: { status: "ABERTA" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      quantity: true,
      notes: true,
      status: true,
      createdAt: true,
      readyAt: true,
      comanda: { select: { id: true, number: true, table: { select: { name: true } }, reservation: { select: { room: { select: { number: true } } } } } },
    },
  });
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    notes: i.notes,
    status: i.status as ItemStatus,
    createdAt: i.createdAt.toISOString(),
    readyAt: i.readyAt?.toISOString() ?? null,
    comandaId: i.comanda.id,
    comandaNumber: i.comanda.number,
    place: i.comanda.table ? `Mesa ${i.comanda.table.name}` : i.comanda.reservation?.room ? `Quarto ${i.comanda.reservation.room.number}` : "Balcão",
  }));
}

// ----------------------------------------------------------------
// COMANDA
// ----------------------------------------------------------------

async function openOnly(db: Db, id: string) {
  const c = await db.comanda.findUnique({ where: { id }, select: { status: true } });
  if (!c) return "Comanda não encontrada.";
  return c.status === "ABERTA" ? null : "Esta comanda já foi encerrada.";
}

export async function openComanda(db: Db, actor: SessionUser, input: unknown): Promise<Result<{ id: string }>> {
  const no = denied(actor, "restaurant.use");
  if (no) return no;
  const parsed = openComandaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  if (d.tableId) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"table:" + d.tableId}))`;
    const busy = await db.comanda.findFirst({ where: { tableId: d.tableId, status: "ABERTA" }, select: { number: true } });
    if (busy) return { ok: false, error: `Esta mesa já tem a comanda nº ${busy.number} aberta.` };
  }
  if (d.reservationId) {
    const r = await db.reservation.findUnique({ where: { id: d.reservationId }, select: { status: true } });
    if (r?.status !== "HOSPEDADA") return { ok: false, error: "Esse hóspede não está na casa." };
  }

  const c = await db.comanda.create({
    data: {
      tableId: d.tableId ?? null,
      reservationId: d.reservationId ?? null,
      customerName: d.customerName,
      people: d.people,
      serviceFee: d.serviceFee,
      serviceFeeBp: await getServiceFeeBp(db),
      openedById: actor.id,
    },
    select: { id: true },
  });
  return { ok: true, id: c.id };
}

export async function updateComanda(
  db: Db,
  actor: SessionUser,
  id: string,
  input: { serviceFee?: boolean; reservationId?: string | null; people?: number }
): Promise<Result> {
  const no = denied(actor, "restaurant.use");
  if (no) return no;
  const closed = await openOnly(db, id);
  if (closed) return { ok: false, error: closed };
  if (input.reservationId) {
    const r = await db.reservation.findUnique({ where: { id: input.reservationId }, select: { status: true } });
    if (r?.status !== "HOSPEDADA") return { ok: false, error: "Esse hóspede não está na casa." };
  }
  await db.comanda.update({
    where: { id },
    data: {
      ...(typeof input.serviceFee === "boolean" ? { serviceFee: input.serviceFee } : {}),
      ...(input.reservationId !== undefined ? { reservationId: input.reservationId } : {}),
      ...(typeof input.people === "number" && input.people >= 1 && input.people <= 50 ? { people: Math.round(input.people) } : {}),
    },
  });
  return { ok: true };
}

export async function addItems(db: Db, actor: SessionUser, comandaId: string, input: unknown): Promise<Result<{ kitchen: number }>> {
  const no = denied(actor, "restaurant.use");
  if (no) return no;
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Pedido inválido." };
  const closed = await openOnly(db, comandaId);
  if (closed) return { ok: false, error: closed };

  const menu = await db.menuItem.findMany({
    where: { id: { in: parsed.data.map((i) => i.menuItemId) }, outlet: "RESTAURANTE", active: true },
    select: { id: true, name: true, priceCents: true, kitchen: true },
  });
  const byId = new Map(menu.map((m) => [m.id, m]));
  if (parsed.data.some((i) => !byId.has(i.menuItemId))) return { ok: false, error: "Algum item saiu do cardápio. Atualize a tela." };

  let kitchen = 0;
  for (const i of parsed.data) {
    const m = byId.get(i.menuItemId)!;
    if (m.kitchen) kitchen++;
    await db.comandaItem.create({
      data: {
        comandaId,
        menuItemId: m.id,
        name: m.name,
        unitCents: m.priceCents,
        quantity: i.quantity,
        notes: i.notes,
        kitchen: m.kitchen,
        // Item que não passa pela cozinha (ex.: refrigerante) já sai entregue.
        status: m.kitchen ? "PENDENTE" : "ENTREGUE",
        deliveredAt: m.kitchen ? null : new Date(),
        createdById: actor.id,
      },
    });
  }
  return { ok: true, kitchen };
}

export async function setItemStatus(db: Db, actor: SessionUser, itemId: string, status: "PRONTO" | "ENTREGUE"): Promise<Result> {
  const no = denied(actor, status === "PRONTO" ? "kitchen.view" : "restaurant.use");
  if (no) return no;
  const item = await db.comandaItem.findUnique({ where: { id: itemId }, select: { status: true, comanda: { select: { status: true } } } });
  if (!item || item.comanda.status !== "ABERTA") return { ok: false, error: "Item não encontrado ou comanda encerrada." };
  const allowed = status === "PRONTO" ? item.status === "PENDENTE" : item.status === "PENDENTE" || item.status === "PRONTO";
  if (!allowed) return { ok: false, error: "Este item já mudou de situação. A tela vai se atualizar." };
  await db.comandaItem.update({
    where: { id: itemId },
    data: status === "PRONTO" ? { status, readyAt: new Date() } : { status, deliveredAt: new Date() },
  });
  return { ok: true };
}

export async function cancelItem(db: Db, actor: SessionUser, itemId: string, reason: unknown): Promise<Result> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const item = await db.comandaItem.findUnique({
    where: { id: itemId },
    select: { status: true, name: true, comandaId: true, comanda: { select: { status: true } } },
  });
  if (!item || item.comanda.status !== "ABERTA") return { ok: false, error: "Item não encontrado ou comanda encerrada." };
  if (item.status === "CANCELADO") return { ok: false, error: "Item já cancelado." };
  // Ainda na cozinha: o garçom cancela. Já pronto/entregue: só a chefia.
  const no = denied(actor, item.status === "PENDENTE" ? "restaurant.use" : "restaurant.cancel");
  if (no) return { ok: false, error: "Item já preparado: só gerente ou administrador cancela." };
  await db.comandaItem.update({ where: { id: itemId }, data: { status: "CANCELADO", cancelReason: parsed.data } });
  await audit(db, "comanda.item_cancelled", { userId: actor.id, metadata: { itemId, name: item.name, reason: parsed.data } });
  return { ok: true };
}

export async function addPosPayment(db: Db, actor: SessionUser, comandaId: string, input: unknown): Promise<Result> {
  const no = denied(actor, "restaurant.use");
  if (no) return no;
  const parsed = posPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
  const c = await findComanda(db, comandaId);
  if (!c || c.status !== "ABERTA") return { ok: false, error: "Comanda encerrada." };
  const { remaining } = toView(c).totals;
  if (parsed.data.amount > remaining) {
    return { ok: false, error: `Falta pagar ${formatBRL(remaining)}. Registre só esse valor; o troco aparece na tela.` };
  }
  await db.posPayment.create({
    data: {
      comandaId,
      method: parsed.data.method,
      amountCents: parsed.data.amount,
      reference: parsed.data.reference,
      businessDate: fromDateStr(await getBusinessDate(db)),
      createdById: actor.id,
    },
  });
  await audit(db, "comanda.payment", { userId: actor.id, metadata: { comandaId, method: parsed.data.method, amount: parsed.data.amount } });
  return { ok: true };
}

// Fechar pago: tudo recebido no restaurante.
export async function closePaid(db: Db, actor: SessionUser, comandaId: string): Promise<Result> {
  const no = denied(actor, "restaurant.use");
  if (no) return no;
  const c = await findComanda(db, comandaId);
  if (!c || c.status !== "ABERTA") return { ok: false, error: "Comanda encerrada." };
  const t = toView(c).totals;
  if (t.total === 0) return { ok: false, error: "Comanda sem itens: cancele em vez de fechar." };
  if (t.remaining > 0) return { ok: false, error: `Ainda falta receber ${formatBRL(t.remaining)}.` };
  await db.comanda.update({
    where: { id: comandaId },
    data: { status: "FECHADA", settlement: "PAGO", totalCents: t.total, closedAt: new Date(), closedById: actor.id },
  });
  return { ok: true };
}

// Fechar lançando o que falta na conta do quarto do hóspede.
export async function closeToRoom(db: Db, actor: SessionUser, comandaId: string, reservationId: string): Promise<Result> {
  const no = denied(actor, "restaurant.use");
  if (no) return no;
  const c = await findComanda(db, comandaId);
  if (!c || c.status !== "ABERTA") return { ok: false, error: "Comanda encerrada." };
  const v = toView(c);
  if (v.totals.total === 0) return { ok: false, error: "Comanda sem itens: cancele em vez de fechar." };
  if (v.totals.remaining <= 0) return { ok: false, error: "Nada a lançar: a comanda já está paga." };

  const where = v.tableName ? `mesa ${v.tableName}` : "balcão";
  const fee = v.serviceFee && v.totals.service > 0 ? ` (inclui ${v.serviceFeeBp / 100}% de serviço)` : "";
  const err = await postOutletCharge(db, actor.id, reservationId, {
    category: "RESTAURANTE",
    description: `Restaurante comanda nº ${v.number}, ${where}${fee}`,
    quantity: 1,
    unitCents: v.totals.remaining,
  });
  if (err) return { ok: false, error: err };

  await db.comanda.update({
    where: { id: comandaId },
    data: { status: "FECHADA", settlement: "QUARTO", reservationId, totalCents: v.totals.total, closedAt: new Date(), closedById: actor.id },
  });
  await db.reservationEvent.create({
    data: { reservationId, userId: actor.id, type: "conta", message: `Restaurante comanda nº ${v.number}: ${formatBRL(v.totals.remaining)}` },
  });
  return { ok: true };
}

export async function cancelComanda(db: Db, actor: SessionUser, comandaId: string, reason: unknown): Promise<Result> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const c = await findComanda(db, comandaId);
  if (!c || c.status !== "ABERTA") return { ok: false, error: "Comanda encerrada." };
  const v = toView(c);
  if (v.payments.length > 0) return { ok: false, error: "Esta comanda tem pagamento registrado: não pode ser cancelada." };
  const hasItems = v.items.some((i) => i.status !== "CANCELADO");
  const no = denied(actor, hasItems ? "restaurant.cancel" : "restaurant.use");
  if (no) return { ok: false, error: "Comanda com itens: só gerente ou administrador cancela." };
  await db.comanda.update({
    where: { id: comandaId },
    data: { status: "CANCELADA", cancelReason: parsed.data, closedAt: new Date(), closedById: actor.id },
  });
  await audit(db, "comanda.cancelled", { userId: actor.id, metadata: { comandaId, reason: parsed.data } });
  return { ok: true };
}

// ----------------------------------------------------------------
// CARDÁPIO E MESAS
// ----------------------------------------------------------------

export async function saveMenuItem(db: Db, actor: SessionUser, id: string | null, input: unknown): Promise<Result> {
  const no = denied(actor, "menu.manage");
  if (no) return no;
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
  const { price, ...data } = parsed.data;
  const clash = await db.menuItem.findFirst({ where: { outlet: data.outlet, name: data.name, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return { ok: false, error: "Revise os campos.", fieldErrors: { name: ["Já existe um item com esse nome."] } };
  if (id) await db.menuItem.update({ where: { id }, data: { ...data, priceCents: price } });
  else await db.menuItem.create({ data: { ...data, priceCents: price } });
  await audit(db, "menu.saved", { userId: actor.id, metadata: { id, name: data.name, price } });
  return { ok: true };
}

export async function saveTable(db: Db, actor: SessionUser, id: string | null, input: unknown): Promise<Result> {
  const no = denied(actor, "menu.manage");
  if (no) return no;
  const parsed = tableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
  const clash = await db.diningTable.findFirst({ where: { name: parsed.data.name, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return { ok: false, error: "Revise os campos.", fieldErrors: { name: ["Já existe uma mesa com esse nome."] } };
  if (id) await db.diningTable.update({ where: { id }, data: parsed.data });
  else await db.diningTable.create({ data: parsed.data });
  return { ok: true };
}

export { getServiceFeeBp };

// Pagamentos do restaurante num dia (borderô).
export async function posPaymentsByDay(db: Db, date: string) {
  const rows = await db.posPayment.findMany({
    where: { businessDate: fromDateStr(date) },
    orderBy: { createdAt: "asc" },
    select: { id: true, method: true, amountCents: true, createdAt: true, comanda: { select: { id: true, number: true } }, createdBy: { select: { fullName: true } } },
  });
  const byMethod = Object.fromEntries((Object.keys(METHOD) as Method[]).map((m) => [m, 0])) as Record<Method, number>;
  for (const r of rows) byMethod[r.method as Method] += r.amountCents;
  return { byMethod, total: rows.reduce((s, r) => s + r.amountCents, 0), rows };
}
