import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { fromDateStr } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getBusinessDate } from "@/lib/hotel-date";
import { postOutletCharge } from "@/lib/folio/service";
import { minibarSchema } from "@/lib/restaurant/rules";

// ================================================================
// FRIGOBAR
// ================================================================
//
// A camareira (ou a recepção) confere o frigobar e marca o que foi
// consumido: cada item vira uma cobrança FRIGOBAR na conta do quarto.
// A lista "consumido hoje" serve para repor os frigobares.

export async function postMinibar(
  db: Db,
  actor: SessionUser,
  reservationId: string,
  input: unknown
): Promise<({ ok: true; total: number }) | Failure> {
  if (!can(actor.role, "minibar.post")) return { ok: false, error: "Seu cargo não pode lançar frigobar." };
  const parsed = minibarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Lançamento inválido." };

  const menu = await db.menuItem.findMany({
    where: { id: { in: parsed.data.map((i) => i.menuItemId) }, outlet: "FRIGOBAR", active: true },
    select: { id: true, name: true, priceCents: true },
  });
  const byId = new Map(menu.map((m) => [m.id, m]));
  if (parsed.data.some((i) => !byId.has(i.menuItemId))) return { ok: false, error: "Algum item saiu do cardápio do frigobar. Atualize a tela." };

  let total = 0;
  for (const i of parsed.data) {
    const m = byId.get(i.menuItemId)!;
    const err = await postOutletCharge(db, actor.id, reservationId, {
      category: "FRIGOBAR",
      description: `Frigobar: ${m.name}`,
      quantity: i.quantity,
      unitCents: m.priceCents,
    });
    if (err) return { ok: false, error: err };
    total += i.quantity * m.priceCents;
  }
  await db.reservationEvent.create({
    data: { reservationId, userId: actor.id, type: "conta", message: `Frigobar: ${parsed.data.length} item(ns), ${formatBRL(total)}` },
  });
  await audit(db, "minibar.posted", { userId: actor.id, metadata: { reservationId, total } });
  return { ok: true, total };
}

// O que foi consumido (e não estornado) hoje, por quarto — para repor.
export async function minibarToday(db: Db) {
  const today = await getBusinessDate(db);
  const rows = await db.folioEntry.findMany({
    where: { category: "FRIGOBAR", businessDate: fromDateStr(today), reversalOfId: null, reversedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      description: true,
      quantity: true,
      amountCents: true,
      createdAt: true,
      createdBy: { select: { fullName: true } },
      reservation: { select: { room: { select: { number: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    item: r.description.replace(/^Frigobar:\s*/, ""),
    quantity: r.quantity,
    amountCents: r.amountCents,
    room: r.reservation.room?.number ?? "—",
    by: r.createdBy?.fullName ?? "Sistema",
    createdAt: r.createdAt.toISOString(),
  }));
}
