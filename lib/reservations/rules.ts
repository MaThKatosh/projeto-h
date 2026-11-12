import { z } from "zod";
import { guestFnrhFields } from "@/lib/guests/fnrh";
import { isDateStr, nightsBetween, type DateStr } from "@/lib/dates";
import { parseBRL } from "@/lib/money";
import { displayStatus, type RoomState } from "@/lib/rooms/status";

// ================================================================
// REGRAS DE RESERVA (sem dependências do servidor)
// ================================================================

export type ReservationStatus = "CONFIRMADA" | "HOSPEDADA" | "FINALIZADA" | "CANCELADA" | "NO_SHOW";

export const ACTIVE_STATUSES: ReservationStatus[] = ["CONFIRMADA", "HOSPEDADA"];

export const STATUS: Record<ReservationStatus, { label: string; chip: string; bar: string }> = {
  CONFIRMADA: { label: "Confirmada", chip: "bg-sky-100 text-sky-800", bar: "bg-sky-500 text-white" },
  HOSPEDADA: { label: "Hospedado", chip: "bg-blue-600 text-white", bar: "bg-blue-700 text-white" },
  FINALIZADA: { label: "Check-out feito", chip: "bg-zinc-200 text-zinc-700", bar: "bg-zinc-400 text-white" },
  CANCELADA: { label: "Cancelada", chip: "bg-red-100 text-red-700", bar: "bg-red-300 text-red-900" },
  NO_SHOW: { label: "Não compareceu", chip: "bg-amber-100 text-amber-800", bar: "bg-amber-300 text-amber-900" },
};

export const SOURCES = [
  "BALCAO",
  "TELEFONE",
  "EMAIL",
  "WHATSAPP",
  "SITE",
  "BOOKING",
  "HOTEIS_COM",
  "EXPEDIA",
  "DECOLAR",
  "AIRBNB",
  "AGENCIA",
  "OUTRO",
] as const;

export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  BALCAO: "Balcão",
  TELEFONE: "Telefone",
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  SITE: "Site do hotel",
  BOOKING: "Booking.com",
  HOTEIS_COM: "Hoteis.com",
  EXPEDIA: "Expedia",
  DECOLAR: "Decolar",
  AIRBNB: "Airbnb",
  AGENCIA: "Agência",
  OUTRO: "Outro",
};

export const DOC_TYPES = ["CPF", "RG", "PASSAPORTE", "OUTRO"] as const;

// ----------------------------------------------------------------
// Valores
// ----------------------------------------------------------------

export function computeTotals(input: { nights: number; dailyCents: number; chargeIss: boolean; issBasisPoints: number }) {
  const lodging = input.nights * input.dailyCents;
  const iss = input.chargeIss ? Math.round((lodging * input.issBasisPoints) / 10_000) : 0;
  return { nights: input.nights, lodging, iss, total: lodging + iss };
}

// ----------------------------------------------------------------
// Disponibilidade: dado o número de quartos de um tipo e as reservas
// ativas que pedem esse tipo, quantos sobram em CADA noite.
// ----------------------------------------------------------------

export function freeByNight(
  supply: number,
  reservations: { checkIn: DateStr; checkOut: DateStr }[],
  nights: DateStr[]
): number[] {
  return nights.map((night) => supply - reservations.filter((r) => r.checkIn <= night && night < r.checkOut).length);
}

// Quarto pode receber hóspede agora? (livre, limpo, sem manutenção que impeça)
export function roomReadyReason(room: RoomState & { active?: boolean }): string | null {
  if (room.active === false) return "Quarto desativado.";
  if (room.occupancy === "OCUPADO") return "Quarto ocupado.";
  if (room.maintenance === "BLOQUEADO") return "Quarto bloqueado.";
  if (room.maintenance === "EM_MANUTENCAO") return "Quarto em manutenção.";
  if (room.housekeeping !== "LIMPO") return "Quarto ainda não está limpo. Peça prioridade à governança ou escolha outro.";
  return displayStatus(room) === "LIVRE" ? null : "Quarto indisponível.";
}

// ----------------------------------------------------------------
// Validação dos formulários
// ----------------------------------------------------------------

const dateStr = z.string().refine(isDateStr, "Data inválida.");

const money = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const cents = parseBRL(v);
    if (cents === null || cents < 0 || cents > 100_000_000) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Ex.: 250,00" });
      return z.NEVER;
    }
    return cents;
  });

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional().transform((v) => v || null);

export const guestSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(120, "Nome longo demais."),
  docType: z.enum(DOC_TYPES).optional().or(z.literal("").transform(() => undefined)),
  docNumber: optionalText(30),
  phone: optionalText(30),
  email: z.string().trim().max(120).optional().transform((v) => v || null).refine((v) => !v || /.+@.+\..+/.test(v), "E-mail inválido."),
  birthDate: z.string().optional().transform((v) => v || null).refine((v) => v === null || isDateStr(v), "Data inválida."),
  nationality: optionalText(40),
  city: optionalText(60),
  state: optionalText(30),
  ...guestFnrhFields,
  notes: optionalText(500),
});

export type GuestInput = z.infer<typeof guestSchema>;

export const stayFields = z
  .object({
    checkIn: dateStr,
    checkOut: dateStr,
    adults: z.coerce.number().int().min(1, "Pelo menos 1 adulto.").max(20),
    children: z.coerce.number().int().min(0).max(20).default(0),
    roomTypeId: z.uuid("Escolha o tipo de quarto."),
    ratePlanId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    daily: money,
    breakfast: z.boolean(),
    chargeIss: z.boolean(),
    issPercent: z.coerce.number().min(0).max(20, "ISS acima de 20%?").default(5),
    source: z.enum(SOURCES).default("BALCAO"),
    externalCode: optionalText(40),
    notes: optionalText(1000),
    roomId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  })
  .refine((d) => d.checkOut > d.checkIn, { path: ["checkOut"], message: "A saída precisa ser depois da entrada." })
  .refine((d) => nightsBetween(d.checkIn, d.checkOut) <= 90, { path: ["checkOut"], message: "No máximo 90 noites por reserva." });

export type StayInput = z.infer<typeof stayFields>;

export const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/[^A-Z0-9]/g, ""))
    .pipe(z.string().min(5, "Placa inválida.").max(8, "Placa inválida.")),
  model: optionalText(40),
  color: optionalText(20),
  spot: optionalText(10),
});
