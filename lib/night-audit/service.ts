import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { addDays, formatDate, fromDateStr, localToday, toDateStr, type DateStr } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getBusinessDate } from "@/lib/hotel-date";
import { postNights, previewNights } from "@/lib/folio/service";

// ================================================================
// AUDITORIA NOTURNA
// ================================================================
//
// Fecha o dia do sistema:
//   1. confere pendências (quem devia chegar, quem devia sair);
//   2. lança a diária desta noite (+ ISS + garagem) de cada hóspede na casa,
//      e qualquer noite anterior que tenha ficado para trás;
//   3. guarda os números do dia (ocupação, receita, recebido);
//   4. vira a data do sistema para o dia seguinte.
// Tudo numa transação: ou faz tudo, ou nada.

export type Pending = { id: string; number: number; guestName: string; roomNumber: string | null; date: DateStr };

export async function auditChecklist(db: Db) {
  const today = await getBusinessDate(db);
  const day = fromDateStr(today);
  const [arrivals, departures, comandas, inHouse, lastRun] = await Promise.all([
    db.reservation.findMany({
      where: { status: "CONFIRMADA", checkIn: { lte: day } },
      select: { id: true, number: true, checkIn: true, guest: { select: { fullName: true } }, room: { select: { number: true } } },
      orderBy: { checkIn: "asc" },
    }),
    db.reservation.findMany({
      where: { status: "HOSPEDADA", checkOut: { lte: day } },
      select: { id: true, number: true, checkOut: true, guest: { select: { fullName: true } }, room: { select: { number: true } } },
      orderBy: { checkOut: "asc" },
    }),
    db.comanda.findMany({ where: { status: "ABERTA" }, select: { id: true, number: true, table: { select: { name: true } } } }),
    db.reservation.findMany({ where: { status: "HOSPEDADA" }, select: { id: true } }),
    db.auditRun.findFirst({ orderBy: { businessDate: "desc" }, select: { businessDate: true, finishedAt: true, user: { select: { fullName: true } } } }),
  ]);

  // Prévia do que a auditoria vai lançar (noite de hoje + atrasadas).
  let nights = 0;
  let total = 0;
  for (const r of inHouse) {
    const p = await previewNights(db, r.id, addDays(today, 1));
    nights += p.nights.length;
    total += p.total;
  }

  const next = addDays(today, 1);
  const tooEarly = next > addDays(localToday(), 1);
  const toRow = (r: (typeof arrivals)[number] | (typeof departures)[number], date: Date): Pending => ({
    id: r.id,
    number: r.number,
    guestName: r.guest.fullName,
    roomNumber: r.room?.number ?? null,
    date: toDateStr(date),
  });

  return {
    today,
    next,
    tooEarly,
    arrivals: arrivals.map((r) => toRow(r, r.checkIn)),
    departures: departures.map((r) => toRow(r, r.checkOut)),
    openComandas: comandas.map((c) => ({ id: c.id, number: c.number, place: c.table ? `Mesa ${c.table.name}` : "Balcão/quarto" })),
    preview: { guests: inHouse.length, nights, total },
    lastRun: lastRun
      ? { date: toDateStr(lastRun.businessDate), finishedAt: lastRun.finishedAt?.toISOString() ?? null, by: lastRun.user?.fullName ?? "Sistema" }
      : null,
    canRun: arrivals.length === 0 && departures.length === 0 && !tooEarly,
  };
}

export type AuditChecklist = Awaited<ReturnType<typeof auditChecklist>>;

export async function runAudit(db: Db, actor: SessionUser): Promise<({ ok: true; date: DateStr; next: DateStr; nights: number; total: number }) | Failure> {
  if (!can(actor.role, "audit.run")) return { ok: false, error: "Seu cargo não pode rodar a auditoria." };

  // Uma auditoria por vez.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('night-audit'))`;

  const check = await auditChecklist(db);
  if (check.tooEarly) {
    return { ok: false, error: `A data do sistema já é ${formatDate(check.today, true)}. A próxima auditoria só pode rodar a partir da noite desse dia.` };
  }
  if (check.arrivals.length) return { ok: false, error: `Há ${check.arrivals.length} chegada(s) pendente(s): faça o check-in, marque "não compareceu" ou mude a data.` };
  if (check.departures.length) return { ok: false, error: `Há ${check.departures.length} saída(s) pendente(s): faça o check-out ou prorrogue a estadia.` };

  const today = check.today;
  const day = fromDateStr(today);
  if (await db.auditRun.findUnique({ where: { businessDate: day }, select: { id: true } })) {
    return { ok: false, error: "Este dia já foi auditado." };
  }

  const run = await db.auditRun.create({ data: { businessDate: day, nextDate: fromDateStr(check.next), userId: actor.id }, select: { id: true } });

  // 1. Diárias
  const inHouse = await db.reservation.findMany({ where: { status: "HOSPEDADA" }, select: { id: true, adults: true, children: true } });
  let nights = 0;
  let total = 0;
  for (const r of inHouse) {
    const posted = await postNights(db, actor, r.id, check.next);
    nights += posted.nights.length;
    total += posted.total;
    if (posted.nights.length) {
      await db.reservationEvent.create({
        data: { reservationId: r.id, userId: actor.id, type: "conta", message: `Auditoria: ${posted.nights.length} diária(s), ${formatBRL(posted.total)}` },
      });
    }
  }

  // 2. Números do dia
  const [roomsAvailable, charges, lodging, payments, pos] = await Promise.all([
    db.room.count({ where: { active: true, maintenance: { notIn: ["BLOQUEADO", "EM_MANUTENCAO"] } } }),
    db.folioEntry.aggregate({ where: { businessDate: day, kind: "COBRANCA" }, _sum: { amountCents: true } }),
    db.folioEntry.aggregate({ where: { businessDate: day, kind: "COBRANCA", category: "DIARIA" }, _sum: { amountCents: true } }),
    db.folioEntry.aggregate({ where: { businessDate: day, kind: "PAGAMENTO" }, _sum: { amountCents: true } }),
    db.posPayment.aggregate({ where: { businessDate: day }, _sum: { amountCents: true } }),
  ]);
  const guests = inHouse.reduce((s, r) => s + r.adults + r.children, 0);

  await db.auditRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      nightsPosted: nights,
      nightsCents: total,
      roomsOccupied: inHouse.length,
      roomsAvailable,
      guests,
      lodgingCents: lodging._sum.amountCents ?? 0,
      revenueCents: charges._sum.amountCents ?? 0,
      receivedCents: (payments._sum.amountCents ?? 0) + (pos._sum.amountCents ?? 0),
      summary: { openComandas: check.openComandas.length },
    },
  });

  // 3. Vira a data
  await db.setting.upsert({ where: { key: "businessDate" }, create: { key: "businessDate", value: check.next }, update: { value: check.next } });
  await audit(db, "audit.run", { userId: actor.id, metadata: { date: today, next: check.next, nights, total } });

  return { ok: true, date: today, next: check.next, nights, total };
}

export async function auditHistory(db: Db, take = 30) {
  const rows = await db.auditRun.findMany({
    orderBy: { businessDate: "desc" },
    take,
    select: {
      id: true,
      businessDate: true,
      finishedAt: true,
      nightsPosted: true,
      nightsCents: true,
      roomsOccupied: true,
      roomsAvailable: true,
      guests: true,
      lodgingCents: true,
      revenueCents: true,
      receivedCents: true,
      user: { select: { fullName: true } },
    },
  });
  return rows.map((r) => ({ ...r, businessDate: toDateStr(r.businessDate), finishedAt: r.finishedAt?.toISOString() ?? null, by: r.user?.fullName ?? "Sistema" }));
}
