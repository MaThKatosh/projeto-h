import { z } from "zod";
import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { fieldErrors } from "@/lib/auth/validation";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { METHODS, type Method } from "@/lib/folio/rules";
import { LOCALES, type Locale } from "@/lib/i18n/locales";

// ================================================================
// CONFIGURAÇÕES DO HOTEL (tabela Setting, chave/valor)
// ================================================================

async function read(db: Db, key: string) {
  return (await db.setting.findUnique({ where: { key } }))?.value;
}

async function write(db: Db, key: string, value: unknown) {
  await db.setting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}

export async function getParkingDailyCents(db: Db): Promise<number> {
  const n = Number((await read(db, "parkingDailyCents")) ?? 0);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export async function setParkingDailyCents(db: Db, cents: number) {
  await write(db, "parkingDailyCents", cents);
}

// Vagas da garagem (0 = sem limite).
export async function getParkingSpots(db: Db): Promise<number> {
  const n = Number((await read(db, "parkingSpots")) ?? 0);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export async function setParkingSpots(db: Db, spots: number) {
  await write(db, "parkingSpots", spots);
}

// Garagem lotada? Devolve a mensagem para a tela, ou null se há vaga.
export async function parkingFull(db: Db): Promise<string | null> {
  const spots = await getParkingSpots(db);
  if (!spots) return null;
  // um de cada vez: duas recepções não ocupam a última vaga juntas
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('garagem'))`;
  const used = await db.vehicle.count({ where: { exitedAt: null } });
  return used >= spots ? `Garagem lotada: ${used} de ${spots} vagas ocupadas.` : null;
}

export type HotelSettings = {
  hotelName: string;
  defaultLocale: Locale;
  checkInTime: string;
  checkOutTime: string;
  enabledMethods: Method[];
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getHotelSettings(db: Db): Promise<HotelSettings> {
  const rows = await db.setting.findMany({
    where: { key: { in: ["hotelName", "defaultLocale", "checkInTime", "checkOutTime", "enabledMethods"] } },
  });
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const methods = Array.isArray(v.enabledMethods) ? (v.enabledMethods as string[]).filter((m): m is Method => (METHODS as readonly string[]).includes(m)) : [...METHODS];
  return {
    hotelName: typeof v.hotelName === "string" && v.hotelName.trim() ? v.hotelName : "Sistema do Hotel",
    defaultLocale: LOCALES.includes(v.defaultLocale as Locale) ? (v.defaultLocale as Locale) : "pt-BR",
    checkInTime: typeof v.checkInTime === "string" && TIME.test(v.checkInTime) ? v.checkInTime : "14:00",
    checkOutTime: typeof v.checkOutTime === "string" && TIME.test(v.checkOutTime) ? v.checkOutTime : "12:00",
    enabledMethods: methods.length ? methods : [...METHODS],
  };
}

const hotelSchema = z.object({
  hotelName: z.string().trim().min(2, "Informe o nome do hotel.").max(60),
  defaultLocale: z.enum(LOCALES),
  checkInTime: z.string().regex(TIME, "Hora inválida (ex.: 14:00)."),
  checkOutTime: z.string().regex(TIME, "Hora inválida (ex.: 12:00)."),
  enabledMethods: z.array(z.enum(METHODS)).min(1, "Deixe pelo menos uma forma de pagamento ativa."),
});

export async function saveHotelSettings(db: Db, actor: SessionUser, input: unknown): Promise<{ ok: true } | Failure> {
  if (!can(actor.role, "settings.manage")) return { ok: false, error: "Seu cargo não pode mudar as configurações." };
  const parsed = hotelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  for (const [k, val] of Object.entries(parsed.data)) await write(db, k, val);
  await audit(db, "settings.hotel", { userId: actor.id, metadata: parsed.data });
  return { ok: true };
}

// ----------------------------------------------------------------
// Bandeiras de cartão
// ----------------------------------------------------------------

export async function listCardBrands(db: Db, activeOnly = false) {
  return db.cardBrand.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, sortOrder: true },
  });
}

const brandSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da bandeira.").max(30),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
});

export async function saveCardBrand(db: Db, actor: SessionUser, id: string | null, input: unknown): Promise<{ ok: true } | Failure> {
  if (!can(actor.role, "settings.manage")) return { ok: false, error: "Seu cargo não pode mudar as configurações." };
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const clash = await db.cardBrand.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return { ok: false, error: "Revise os campos destacados.", fieldErrors: { name: ["Essa bandeira já existe."] } };
  if (id) await db.cardBrand.update({ where: { id }, data: parsed.data });
  else await db.cardBrand.create({ data: parsed.data });
  await audit(db, "settings.card_brand", { userId: actor.id, metadata: { id, ...parsed.data } });
  return { ok: true };
}

// Confere a forma de pagamento e a bandeira escolhidas (servidor).
export async function checkPaymentChoice(db: Db, method: Method, cardBrand: string | null | undefined): Promise<string | null> {
  const { enabledMethods } = await getHotelSettings(db);
  if (!enabledMethods.includes(method)) return "Esta forma de pagamento está desativada nas configurações.";
  if (method === "CREDITO" || method === "DEBITO") {
    const brands = await listCardBrands(db, true);
    if (brands.length && !cardBrand) return "Escolha a bandeira do cartão.";
    if (cardBrand && !brands.some((b) => b.name === cardBrand)) return "Bandeira de cartão inválida ou desativada.";
  }
  return null;
}
