import { z } from "zod";
import { addDays, nightsBetween, type DateStr } from "@/lib/dates";
import { parseBRL } from "@/lib/money";

// ================================================================
// REGRAS DA CONTA DO QUARTO (sem dependências do servidor)
// ================================================================

export const CATEGORIES = ["DIARIA", "ISS", "ESTACIONAMENTO", "FRIGOBAR", "RESTAURANTE", "LAVANDERIA", "TELEFONE", "DANOS", "OUTRO"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  DIARIA: "Diária",
  ISS: "ISS",
  ESTACIONAMENTO: "Estacionamento",
  FRIGOBAR: "Frigobar",
  RESTAURANTE: "Restaurante",
  LAVANDERIA: "Lavanderia",
  TELEFONE: "Telefone",
  DANOS: "Danos",
  OUTRO: "Outros",
};

// Lançadas pelo sistema (diárias), não à mão.
export const AUTOMATIC_CATEGORIES: Category[] = ["DIARIA", "ISS", "ESTACIONAMENTO"];
export const MANUAL_CATEGORIES = CATEGORIES.filter((c) => !AUTOMATIC_CATEGORIES.includes(c));

export const METHODS = ["DINHEIRO", "PIX", "CREDITO", "DEBITO", "TRANSFERENCIA"] as const;
export type Method = (typeof METHODS)[number];

export const METHOD: Record<Method, { label: string; icon: string; color: string }> = {
  DINHEIRO: { label: "Dinheiro", icon: "💵", color: "bg-emerald-100 text-emerald-800" },
  PIX: { label: "Pix", icon: "⚡", color: "bg-teal-100 text-teal-800" },
  CREDITO: { label: "Cartão de crédito", icon: "💳", color: "bg-indigo-100 text-indigo-800" },
  DEBITO: { label: "Cartão de débito", icon: "💳", color: "bg-sky-100 text-sky-800" },
  TRANSFERENCIA: { label: "Transferência", icon: "🏦", color: "bg-zinc-100 text-zinc-800" },
};

// ----------------------------------------------------------------
// Saldo
// ----------------------------------------------------------------

export type EntryLike = { kind: "COBRANCA" | "PAGAMENTO"; amountCents: number };

export function folioTotals(entries: EntryLike[]) {
  let charges = 0;
  let payments = 0;
  for (const e of entries) {
    if (e.kind === "COBRANCA") charges += e.amountCents;
    else payments += e.amountCents;
  }
  return { charges, payments, balance: charges - payments };
}

// ----------------------------------------------------------------
// Diárias
// ----------------------------------------------------------------

// Data de saída efetiva se o hóspede sair HOJE (mesma regra do check-out):
// saída antecipada encurta; mínimo de uma noite.
export function effectiveCheckOut(checkIn: DateStr, checkOut: DateStr, today: DateStr): DateStr {
  if (checkOut <= today) return checkOut;
  return today > checkIn ? today : addDays(checkIn, 1);
}

// Noites de [from, until) que ainda não foram lançadas.
export function nightsToPost(from: DateStr, until: DateStr, posted: Set<DateStr>): DateStr[] {
  const n = Math.max(0, nightsBetween(from, until));
  return Array.from({ length: n }, (_, i) => addDays(from, i)).filter((d) => !posted.has(d));
}

export function issFor(dailyCents: number, chargeIss: boolean, issBasisPoints: number) {
  return chargeIss ? Math.round((dailyCents * issBasisPoints) / 10_000) : 0;
}

// Veículo estava na garagem naquela noite? (datas locais "AAAA-MM-DD")
export function vehicleOnNight(enteredDay: DateStr, exitedDay: DateStr | null, night: DateStr) {
  return enteredDay <= night && (exitedDay === null || exitedDay > night);
}

// ----------------------------------------------------------------
// Validação
// ----------------------------------------------------------------

const cents = (min: number) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const c = parseBRL(v);
    if (c === null || c < min || c > 100_000_000) {
      ctx.addIssue({ code: "custom", message: min > 0 ? "Informe um valor maior que zero. Ex.: 50,00" : "Valor inválido." });
      return z.NEVER;
    }
    return c;
  });

export const chargeSchema = z.object({
  category: z.enum(MANUAL_CATEGORIES as unknown as [Category, ...Category[]], { error: "Escolha o tipo de cobrança." }),
  description: z.string().trim().min(2, "Descreva a cobrança.").max(120),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima 1.").max(999),
  unit: cents(1),
});

export const paymentSchema = z.object({
  method: z.enum(METHODS, { error: "Escolha a forma de pagamento." }),
  amount: cents(1),
  reference: z.string().trim().max(60).optional().transform((v) => v || null),
  installments: z.coerce.number().int().min(1).max(12).optional(),
});

export const refundSchema = z.object({
  method: z.enum(METHODS, { error: "Escolha como devolver." }),
  amount: cents(1),
  reason: z.string().trim().min(3, "Diga o motivo da devolução.").max(200),
});

export const reverseSchema = z.string().trim().min(5, "Explique por que o lançamento está sendo estornado.").max(300);
