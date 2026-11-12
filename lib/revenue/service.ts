import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { fieldErrors } from "@/lib/auth/validation";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { addDays, fromDateStr, nightsBetween, type DateStr } from "@/lib/dates";
import { getBusinessDate } from "@/lib/hotel-date";
import { availability } from "@/lib/reservations/service";
import { paramsFor, ruleSchema, suggestPrice, type Rule, type Suggestion } from "@/lib/revenue/rules";

// ================================================================
// REVENUE MANAGEMENT — previsão, preço sugerido e indicadores
// ================================================================

export async function listRules(db: Db): Promise<Rule[]> {
  const rows = await db.revenueRule.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, params: r.params as Rule["params"], adjustBp: r.adjustBp, roomTypeId: r.roomTypeId, active: r.active }));
}

export async function saveRule(db: Db, actor: SessionUser, id: string | null, input: unknown): Promise<{ ok: true } | Failure> {
  if (!can(actor.role, "revenue.manage")) return { ok: false, error: "Só gerente ou administrador mexe nas regras de preço." };
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const r = parsed.data;
  const data = { name: r.name, kind: r.kind, params: paramsFor(r), adjustBp: Math.round(r.adjustPercent * 100), roomTypeId: r.roomTypeId ?? null, active: r.active };
  if (id) await db.revenueRule.update({ where: { id }, data });
  else await db.revenueRule.create({ data });
  await audit(db, "revenue.rule", { userId: actor.id, metadata: { id, name: r.name } });
  return { ok: true };
}

export async function deleteRule(db: Db, actor: SessionUser, id: string): Promise<{ ok: true } | Failure> {
  if (!can(actor.role, "revenue.manage")) return { ok: false, error: "Só gerente ou administrador mexe nas regras de preço." };
  await db.revenueRule.delete({ where: { id } });
  await audit(db, "revenue.rule.deleted", { userId: actor.id, metadata: { id } });
  return { ok: true };
}

// Preço base de cada tipo: o da tarifa escolhida como base (a primeira
// tarifa ativa, se nenhuma foi escolhida).
export async function basePrices(db: Db): Promise<{ planName: string | null; byType: Map<string, number> }> {
  const plan = await db.ratePlan.findFirst({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true, prices: { select: { roomTypeId: true, dailyCents: true } } } });
  return { planName: plan?.name ?? null, byType: new Map((plan?.prices ?? []).map((p) => [p.roomTypeId, p.dailyCents])) };
}

export type ForecastCell = { date: DateStr; free: number; total: number; occupancyPct: number; base: number | null; suggestion: Suggestion | null };
export type ForecastRow = { roomTypeId: string; name: string; cells: ForecastCell[] };

// Calendário: por tipo e noite, quartos livres, ocupação e preço sugerido.
export async function forecast(db: Db, from: DateStr, days: number) {
  const to = addDays(from, days);
  const [list, rules, base, today] = await Promise.all([availability(db, from, to), listRules(db), basePrices(db), getBusinessDate(db)]);
  const nights = Array.from({ length: days }, (_, i) => addDays(from, i));
  const totalRooms = list.reduce((s, t) => s + t.total, 0);
  // Ocupação do hotel inteiro por noite (é ela que dispara as regras de ocupação).
  const hotelOcc = nights.map((_, i) => {
    const sold = list.reduce((s, t) => s + (t.total - t.byNight[i]), 0);
    return totalRooms ? Math.round((sold / totalRooms) * 100) : 0;
  });
  const rows: ForecastRow[] = list.map((t) => ({
    roomTypeId: t.roomTypeId,
    name: t.name,
    cells: nights.map((date, i) => {
      const b = base.byType.get(t.roomTypeId) ?? null;
      return {
        date,
        free: t.byNight[i],
        total: t.total,
        occupancyPct: t.total ? Math.round(((t.total - t.byNight[i]) / t.total) * 100) : 0,
        base: b,
        suggestion: b === null ? null : suggestPrice(b, rules, { date, today, occupancyPct: hotelOcc[i], roomTypeId: t.roomTypeId }),
      };
    }),
  }));
  return { nights, hotelOcc, rows, planName: base.planName, rules };
}

// Preço sugerido para uma estadia (média das noites) — usado na reserva.
export async function suggestForStay(db: Db, roomTypeId: string, checkIn: DateStr, checkOut: DateStr) {
  const n = nightsBetween(checkIn, checkOut);
  if (n < 1 || n > 90) return null;
  const f = await forecast(db, checkIn, n);
  const row = f.rows.find((r) => r.roomTypeId === roomTypeId);
  const prices = row?.cells.map((c) => c.suggestion?.price).filter((p): p is number => p !== undefined) ?? [];
  if (!prices.length) return null;
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length / 100) * 100;
  const applied = [...new Set(row!.cells.flatMap((c) => c.suggestion?.applied.map((a) => a.name) ?? []))];
  return { dailyCents: avg, applied };
}

// ---------------------------------------------------------------- indicadores

export type Kpis = { occupancyPct: number; adrCents: number; revparCents: number; roomNights: number; revenueCents: number };

// Próximos dias: o que já está reservado ("on the books").
export async function onTheBooks(db: Db, from: DateStr, days: number): Promise<Kpis & { pickup7: number }> {
  const to = addDays(from, days);
  const [rooms, res, pickup] = await Promise.all([
    db.room.count({ where: { active: true, maintenance: { not: "BLOQUEADO" } } }),
    db.reservation.findMany({
      where: { status: { in: ["CONFIRMADA", "HOSPEDADA"] }, checkIn: { lt: fromDateStr(to) }, checkOut: { gt: fromDateStr(from) } },
      select: { checkIn: true, checkOut: true, dailyCents: true },
    }),
    db.reservation.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) }, checkOut: { gt: fromDateStr(from) }, status: { in: ["CONFIRMADA", "HOSPEDADA"] } } }),
  ]);
  let roomNights = 0;
  let revenue = 0;
  for (const r of res) {
    const a = r.checkIn.toISOString().slice(0, 10) > from ? r.checkIn.toISOString().slice(0, 10) : from;
    const b = r.checkOut.toISOString().slice(0, 10) < to ? r.checkOut.toISOString().slice(0, 10) : to;
    const n = Math.max(0, nightsBetween(a, b));
    roomNights += n;
    revenue += n * r.dailyCents;
  }
  const capacity = rooms * days;
  return {
    occupancyPct: capacity ? Math.round((roomNights / capacity) * 1000) / 10 : 0,
    adrCents: roomNights ? Math.round(revenue / roomNights) : 0,
    revparCents: capacity ? Math.round(revenue / capacity) : 0,
    roomNights,
    revenueCents: revenue,
    pickup7: pickup,
  };
}

// Últimos dias: números guardados pela auditoria noturna.
export async function lastDays(db: Db, to: DateStr, days: number): Promise<Kpis & { audits: number }> {
  const runs = await db.auditRun.findMany({
    where: { undoneAt: null, businessDate: { gte: fromDateStr(addDays(to, -days)), lt: fromDateStr(to) } },
    select: { roomsOccupied: true, roomsAvailable: true, lodgingCents: true },
  });
  const sold = runs.reduce((s, r) => s + r.roomsOccupied, 0);
  const avail = runs.reduce((s, r) => s + r.roomsAvailable, 0);
  const revenue = runs.reduce((s, r) => s + r.lodgingCents, 0);
  return {
    occupancyPct: avail ? Math.round((sold / avail) * 1000) / 10 : 0,
    adrCents: sold ? Math.round(revenue / sold) : 0,
    revparCents: avail ? Math.round(revenue / avail) : 0,
    roomNights: sold,
    revenueCents: revenue,
    audits: runs.length,
  };
}
