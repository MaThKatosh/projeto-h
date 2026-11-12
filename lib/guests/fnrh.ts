import { z } from "zod";

// ================================================================
// FNRH — Ficha Nacional de Registro de Hóspedes
// Listas usadas na ficha impressa, no check-in e no relatório.
// ================================================================

export const GENDERS = ["M", "F", "OUTRO"] as const;
export const GENDER_LABEL: Record<string, string> = { M: "Masculino", F: "Feminino", OUTRO: "Outro / prefiro não dizer" };

export const TRAVEL_PURPOSES = ["LAZER", "NEGOCIOS", "CONGRESSO", "PARENTES", "ESTUDOS", "SAUDE", "RELIGIAO", "COMPRAS", "OUTRO"] as const;
export const PURPOSE_LABEL: Record<string, string> = {
  LAZER: "Lazer / férias",
  NEGOCIOS: "Negócios / trabalho",
  CONGRESSO: "Congresso / feira",
  PARENTES: "Visita a parentes e amigos",
  ESTUDOS: "Estudos / cursos",
  SAUDE: "Saúde",
  RELIGIAO: "Religião",
  COMPRAS: "Compras",
  OUTRO: "Outro",
};

export const TRANSPORTS = ["AVIAO", "CARRO", "ONIBUS", "MOTO", "NAVIO", "TREM", "OUTRO"] as const;
export const TRANSPORT_LABEL: Record<string, string> = {
  AVIAO: "Avião",
  CARRO: "Automóvel",
  ONIBUS: "Ônibus",
  MOTO: "Moto",
  NAVIO: "Navio / barco",
  TREM: "Trem",
  OUTRO: "Outro",
};

const optional = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional().transform((v) => v || null);
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().or(z.literal("").transform(() => undefined)).transform((v) => v ?? null);

// Dados da viagem (por estadia).
export const tripSchema = z.object({
  travelPurpose: optionalEnum(TRAVEL_PURPOSES),
  transport: optionalEnum(TRANSPORTS),
  arrivingFrom: optional(80),
  nextDestination: optional(80),
});
export type TripInput = z.infer<typeof tripSchema>;

export const guestFnrhFields = {
  gender: optionalEnum(GENDERS),
  profession: optional(60),
  docIssuer: optional(40),
  address: optional(160),
  zipCode: optional(12),
  country: optional(40),
};

// O que falta na ficha para ela ficar completa (aviso, não bloqueia).
export function missingFnrh(g: {
  fullName: string;
  docNumber: string | null;
  birthDate: string | null;
  nationality: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
}): string[] {
  const out: string[] = [];
  if (!g.docNumber) out.push("documento");
  if (!g.birthDate) out.push("nascimento");
  if (!g.nationality) out.push("nacionalidade");
  if (!g.gender) out.push("sexo");
  if (!g.city && !g.country) out.push("residência");
  return out;
}
