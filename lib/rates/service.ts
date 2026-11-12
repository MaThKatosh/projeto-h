import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { fieldErrors } from "@/lib/auth/validation";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { parseBRL } from "@/lib/money";

// ================================================================
// TARIFAS
// ================================================================
//
// Uma tarifa (ex.: "Balcão", "Booking", "Corporativo") tem um preço de
// diária por tipo de quarto, diz se inclui café e se cobra ISS (e quanto).
// Na reserva os valores são COPIADOS: mudar a tarifa depois não muda
// reservas já feitas.

export type RatePlanView = {
  id: string;
  name: string;
  includesBreakfast: boolean;
  chargeIss: boolean;
  issBasisPoints: number;
  active: boolean;
  prices: Record<string, number>; // roomTypeId → centavos
};

export async function listRatePlans(db: Db, options: { activeOnly?: boolean } = {}): Promise<RatePlanView[]> {
  const plans = await db.ratePlan.findMany({
    where: options.activeOnly ? { active: true } : {},
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { prices: true },
  });
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    includesBreakfast: p.includesBreakfast,
    chargeIss: p.chargeIss,
    issBasisPoints: p.issBasisPoints,
    active: p.active,
    prices: Object.fromEntries(p.prices.map((x) => [x.roomTypeId, x.dailyCents])),
  }));
}

const planSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(50),
  includesBreakfast: z.boolean(),
  chargeIss: z.boolean(),
  issPercent: z.coerce.number().min(0, "ISS inválido.").max(20, "ISS acima de 20%?"),
  active: z.boolean(),
  // roomTypeId → "250,00" (vazio = sem preço para esse tipo)
  prices: z.record(z.string(), z.string()),
});

export async function saveRatePlan(
  db: Db,
  actor: SessionUser,
  id: string | null,
  input: unknown
): Promise<{ ok: true } | Failure> {
  if (!can(actor.role, "rates.manage")) return { ok: false, error: "Seu cargo não pode alterar tarifas." };
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const { prices, issPercent, ...data } = parsed.data;

  const priceRows: { roomTypeId: string; dailyCents: number }[] = [];
  for (const [roomTypeId, raw] of Object.entries(prices)) {
    if (!raw.trim()) continue;
    const cents = parseBRL(raw);
    if (cents === null || cents < 0) {
      return { ok: false, error: "Revise os campos destacados.", fieldErrors: { [`price_${roomTypeId}`]: ["Valor inválido. Ex.: 250,00"] } };
    }
    priceRows.push({ roomTypeId, dailyCents: cents });
  }

  const planData = { ...data, issBasisPoints: Math.round(issPercent * 100) };
  try {
    const plan = id
      ? await db.ratePlan.update({ where: { id }, data: planData, select: { id: true } })
      : await db.ratePlan.create({ data: planData, select: { id: true } });
    await db.ratePrice.deleteMany({ where: { ratePlanId: plan.id } });
    if (priceRows.length) {
      await db.ratePrice.createMany({ data: priceRows.map((p) => ({ ...p, ratePlanId: plan.id })) });
    }
    await audit(db, id ? "rate.updated" : "rate.created", { userId: actor.id, metadata: { id: plan.id, name: data.name } });
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Revise os campos destacados.", fieldErrors: { name: ["Já existe uma tarifa com esse nome."] } };
    }
    throw error;
  }
}
