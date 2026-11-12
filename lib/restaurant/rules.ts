import { z } from "zod";
import { parseBRL } from "@/lib/money";
import { METHODS } from "@/lib/folio/rules";

// ================================================================
// REGRAS DO RESTAURANTE E DO FRIGOBAR (sem dependências do servidor)
// ================================================================

export type ItemStatus = "PENDENTE" | "PRONTO" | "ENTREGUE" | "CANCELADO";

export const ITEM_STATUS: Record<ItemStatus, { label: string; chip: string }> = {
  PENDENTE: { label: "Na cozinha", chip: "bg-amber-100 text-amber-800" },
  PRONTO: { label: "Pronto p/ levar", chip: "bg-emerald-100 text-emerald-800" },
  ENTREGUE: { label: "Entregue", chip: "bg-zinc-100 text-zinc-600" },
  CANCELADO: { label: "Cancelado", chip: "bg-red-100 text-red-700" },
};

// Total da comanda: itens não cancelados + taxa de serviço (opcional).
export function comandaTotals(
  items: { unitCents: number; quantity: number; status: ItemStatus }[],
  serviceFee: boolean,
  serviceFeeBp: number,
  paidCents = 0
) {
  const subtotal = items.filter((i) => i.status !== "CANCELADO").reduce((s, i) => s + i.unitCents * i.quantity, 0);
  const service = serviceFee ? Math.round((subtotal * serviceFeeBp) / 10_000) : 0;
  const total = subtotal + service;
  return { subtotal, service, total, paid: paidCents, remaining: total - paidCents };
}

// Troco do pagamento em dinheiro.
export function change(givenCents: number, remainingCents: number) {
  return Math.max(0, givenCents - remainingCents);
}

// ----------------------------------------------------------------
// Validação
// ----------------------------------------------------------------

const money = (min: number) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const c = parseBRL(v);
    if (c === null || c < min || c > 10_000_000) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Ex.: 25,00" });
      return z.NEVER;
    }
    return c;
  });

export const openComandaSchema = z.object({
  tableId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  reservationId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  customerName: z.string().trim().max(80).optional().transform((v) => v || null),
  people: z.coerce.number().int().min(1).max(50).default(1),
  serviceFee: z.boolean().default(true),
});

export const orderSchema = z
  .array(
    z.object({
      menuItemId: z.uuid(),
      quantity: z.coerce.number().int().min(1, "Quantidade mínima 1.").max(50),
      notes: z.string().trim().max(120).optional().transform((v) => v || null),
    })
  )
  .min(1, "Escolha pelo menos um item.")
  .max(50);

export const posPaymentSchema = z.object({
  method: z.enum(METHODS, { error: "Escolha a forma de pagamento." }),
  amount: money(1),
  reference: z.string().trim().max(60).optional().transform((v) => v || null),
  cardBrand: z.string().trim().max(30).optional().transform((v) => v || null),
});

export const menuItemSchema = z.object({
  outlet: z.enum(["RESTAURANTE", "FRIGOBAR"]),
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  group: z.string().trim().min(2, "Informe o grupo (ex.: Bebidas).").max(30),
  price: money(0),
  kitchen: z.boolean(),
  active: z.boolean(),
});

export const tableSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome/número.").max(20),
  seats: z.coerce.number().int().min(1).max(30),
  active: z.boolean(),
});

export const minibarSchema = z
  .array(z.object({ menuItemId: z.uuid(), quantity: z.coerce.number().int().min(1).max(50) }))
  .min(1, "Marque pelo menos um item consumido.")
  .max(40);

export const reasonSchema = z.string().trim().min(3, "Diga o motivo.").max(200);
