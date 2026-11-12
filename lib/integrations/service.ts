import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { audit } from "@/lib/audit";
import { addDays, isDateStr, nightsBetween, toDateStr, type DateStr } from "@/lib/dates";
import { getBusinessDate } from "@/lib/hotel-date";
import { centsToInput, formatBRL } from "@/lib/money";
import { SOURCES, SOURCE_LABEL, type Source } from "@/lib/reservations/rules";
import { availability, cancelReservation, createReservation, updateReservation } from "@/lib/reservations/service";
import { guessRoomType, type ExternalReservation, type ParsedRow } from "@/lib/integrations/parse";

// ================================================================
// RESERVAS DOS PORTAIS — decide e grava (arquivo e channel manager)
// ================================================================

export type ImportAction = "criar" | "alterar" | "cancelar" | "ignorar" | "erro";

export type ImportOptions = { breakfast: boolean; chargeIss: boolean; issPercent: number };

export type PlanRow = {
  line: number;
  externalCode: string;
  guestName: string;
  checkIn: DateStr | null;
  checkOut: DateStr | null;
  roomTypeLabel: string;
  roomTypeId: string | null;
  totalCents: number | null;
  action: ImportAction;
  reason: string | null;
  reservationNumber: number | null;
};

type Decision = { action: ImportAction; reason: string | null; existing: Existing | null; dailyCents: number | null };

const existingSelect = {
  id: true,
  number: true,
  status: true,
  checkIn: true,
  checkOut: true,
  roomTypeId: true,
  roomId: true,
  dailyCents: true,
  adults: true,
  children: true,
  breakfast: true,
  chargeIss: true,
  issBasisPoints: true,
  ratePlanId: true,
  notes: true,
  externalCode: true,
} as const;

type Existing = NonNullable<Awaited<ReturnType<typeof findExisting>>>;

function findExisting(db: Db, source: Source, code: string) {
  return db.reservation.findFirst({ where: { source, externalCode: code }, select: existingSelect });
}

// Diária: total do portal ÷ noites; sem valor, a menor tarifa ativa do tipo.
async function dailyFor(db: Db, r: ExternalReservation, roomTypeId: string): Promise<number | null> {
  const nights = nightsBetween(r.checkIn, r.checkOut);
  if (r.totalCents !== null && r.totalCents > 0) return Math.round(r.totalCents / nights);
  const price = await db.ratePrice.findFirst({
    where: { roomTypeId, ratePlan: { active: true } },
    orderBy: { dailyCents: "asc" },
    select: { dailyCents: true },
  });
  return price?.dailyCents ?? null;
}

async function decide(db: Db, source: Source, r: ExternalReservation, roomTypeId: string | null, today: DateStr): Promise<Decision> {
  const existing = await findExisting(db, source, r.externalCode);
  const none = { existing, dailyCents: null };

  if (r.cancelled) {
    if (!existing) return { ...none, action: "ignorar", reason: "cancelada no portal (nunca entrou aqui)" };
    if (existing.status === "CONFIRMADA") return { ...none, action: "cancelar", reason: "cancelada no portal" };
    if (existing.status === "HOSPEDADA") return { ...none, action: "erro", reason: "cancelada no portal, mas o hóspede já fez check-in: confira" };
    return { ...none, action: "ignorar", reason: "já estava cancelada ou encerrada" };
  }

  if (existing && existing.status !== "CONFIRMADA") {
    const why: Record<string, string> = {
      HOSPEDADA: "hóspede já está na casa",
      FINALIZADA: "estadia já encerrada",
      CANCELADA: "cancelada aqui no hotel (reative à mão, se for o caso)",
      NO_SHOW: "marcada como não compareceu",
    };
    return { ...none, action: "ignorar", reason: why[existing.status] ?? null };
  }
  if (r.checkIn < today) return { ...none, action: existing ? "ignorar" : "erro", reason: "entrada antes da data do sistema" };
  // Já importada antes: sem escolha nova, fica no tipo que já tem.
  roomTypeId ??= existing?.roomTypeId ?? null;
  if (!roomTypeId) return { ...none, action: "erro", reason: "escolha o tipo de quarto" };

  const dailyCents = await dailyFor(db, r, roomTypeId);
  if (dailyCents === null) return { ...none, action: "erro", reason: "sem valor no arquivo e sem tarifa para este tipo" };

  if (existing) {
    const same =
      toDateStr(existing.checkIn) === r.checkIn &&
      toDateStr(existing.checkOut) === r.checkOut &&
      existing.roomTypeId === roomTypeId &&
      existing.dailyCents === dailyCents &&
      existing.adults === r.adults &&
      existing.children === r.children;
    if (same) return { action: "ignorar", reason: "já importada, sem mudanças", existing, dailyCents };
  }

  const free = (await availability(db, r.checkIn, r.checkOut, { ignoreReservationId: existing?.id })).find((t) => t.roomTypeId === roomTypeId);
  if (!free || free.free < 1) return { action: "erro", reason: "sem quarto livre deste tipo em todas as noites", existing, dailyCents };

  const multi = r.rooms > 1 ? "reserva com vários quartos: entra 1, crie os outros à mão" : null;
  return { action: existing ? "alterar" : "criar", reason: multi, existing, dailyCents };
}

// Prévia (não grava nada).
export async function planImport(
  db: Db,
  source: Source,
  parsed: ParsedRow[],
  typeMap: Record<string, string>
): Promise<PlanRow[]> {
  const today = await getBusinessDate(db);
  const types = await db.roomType.findMany({ select: { id: true, name: true } });
  const seen = new Set<string>();
  const out: PlanRow[] = [];
  for (const p of parsed) {
    if (!p.data) {
      out.push({ line: p.line, externalCode: "", guestName: "", checkIn: null, checkOut: null, roomTypeLabel: "", roomTypeId: null, totalCents: null, action: "erro", reason: p.error ?? null, reservationNumber: null });
      continue;
    }
    const r = p.data;
    const roomTypeId = resolveType(r.roomTypeLabel, typeMap, types);
    const base = { line: p.line, externalCode: r.externalCode, guestName: r.guestName, checkIn: r.checkIn, checkOut: r.checkOut, roomTypeLabel: r.roomTypeLabel, roomTypeId, totalCents: r.totalCents };
    if (seen.has(r.externalCode)) {
      out.push({ ...base, action: "ignorar", reason: "repetida no arquivo", reservationNumber: null });
      continue;
    }
    seen.add(r.externalCode);
    const d = await decide(db, source, r, roomTypeId, today);
    out.push({ ...base, action: d.action, reason: d.reason, reservationNumber: d.existing?.number ?? null });
  }
  return out;
}

function resolveType(label: string, typeMap: Record<string, string>, types: { id: string; name: string }[]): string | null {
  const chosen = typeMap[label];
  if (chosen && types.some((t) => t.id === chosen)) return chosen;
  return guessRoomType(label, types);
}

// Grava UMA reserva de fora (cada uma na sua transação, quem chama decide).
export async function applyExternal(
  db: Db,
  actor: SessionUser,
  source: Source,
  r: ExternalReservation,
  roomTypeId: string | null,
  opts: ImportOptions
): Promise<{ action: ImportAction; reason: string | null; reservationId?: string; number?: number }> {
  const today = await getBusinessDate(db);
  const d = await decide(db, source, r, roomTypeId, today);
  roomTypeId ??= d.existing?.roomTypeId ?? null;
  const label = SOURCE_LABEL[source];

  if (d.action === "cancelar" && d.existing) {
    const res = await cancelReservation(db, actor, d.existing.id, `Cancelada no portal (${label})`);
    if (!res.ok) return { action: "erro", reason: res.error };
    return { action: "cancelar", reason: d.reason, reservationId: d.existing.id, number: d.existing.number };
  }
  if (d.action === "criar" && roomTypeId && d.dailyCents !== null) {
    const guestId = await findGuest(db, r);
    const stay = {
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      adults: r.adults,
      children: r.children,
      roomTypeId,
      daily: centsToInput(d.dailyCents),
      breakfast: opts.breakfast,
      chargeIss: opts.chargeIss,
      issPercent: opts.issPercent,
      source,
      externalCode: r.externalCode,
      notes: r.notes ?? undefined,
    };
    const res = await createReservation(db, actor, guestId ? { guestId, stay } : { guest: { fullName: r.guestName, email: r.email ?? "", phone: r.phone ?? "", country: r.country ?? "" }, stay });
    if (!res.ok) return { action: "erro", reason: describe(res) };
    await db.reservationEvent.create({
      data: { reservationId: res.id, userId: actor.id, type: "portal", message: `Importada de ${label} (código ${r.externalCode}${r.totalCents ? `, total ${formatBRL(r.totalCents)}` : ""})` },
    });
    return { action: "criar", reason: d.reason, reservationId: res.id, number: res.number };
  }
  if (d.action === "alterar" && d.existing && roomTypeId && d.dailyCents !== null) {
    const e = d.existing;
    const res = await updateReservation(db, actor, e.id, {
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      adults: r.adults,
      children: r.children,
      roomTypeId,
      ratePlanId: e.ratePlanId ?? undefined,
      daily: centsToInput(d.dailyCents),
      breakfast: e.breakfast,
      chargeIss: e.chargeIss,
      issPercent: e.issBasisPoints / 100,
      source,
      externalCode: e.externalCode ?? r.externalCode,
      notes: e.notes ?? undefined,
      roomId: e.roomId && e.roomTypeId === roomTypeId ? e.roomId : undefined,
    });
    if (!res.ok) return { action: "erro", reason: describe(res) };
    await db.reservationEvent.create({ data: { reservationId: e.id, userId: actor.id, type: "portal", message: `Alterada pelo portal (${label})` } });
    return { action: "alterar", reason: d.reason, reservationId: e.id, number: e.number };
  }
  return { action: d.action, reason: d.reason, reservationId: d.existing?.id, number: d.existing?.number };
}

function describe(f: Failure): string {
  const first = f.fieldErrors ? Object.values(f.fieldErrors).flat()[0] : null;
  return first ?? f.error;
}

// Reaproveita o cadastro quando o e-mail e o nome batem.
async function findGuest(db: Db, r: ExternalReservation): Promise<string | null> {
  if (!r.email) return null;
  const g = await db.guest.findFirst({
    where: { email: { equals: r.email, mode: "insensitive" }, fullName: { equals: r.guestName, mode: "insensitive" } },
    select: { id: true },
  });
  return g?.id ?? null;
}

// ---------------------------------------------------------------- channel manager

// "#" não é aceito em nomes de usuário: nenhum funcionário consegue criar este.
export const INTEGRATION_USERNAME = "#integracao";

// Usuário técnico que aparece como autor das reservas que chegam pela API.
// Fica inativo: ninguém entra no sistema com ele.
export async function integrationActor(db: Db): Promise<SessionUser> {
  const u = await db.user.upsert({
    where: { username: INTEGRATION_USERNAME },
    update: {},
    create: { username: INTEGRATION_USERNAME, fullName: "Integração (channel manager)", role: "RECEPCAO", active: false, passwordHash: "!" },
    select: { id: true, username: true, fullName: true, role: true },
  });
  return u;
}

const TOKEN_KEY = "integrationToken";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export type TokenInfo = { createdAt: string; last4: string } | null;

export async function tokenInfo(db: Db): Promise<TokenInfo> {
  const s = await db.setting.findUnique({ where: { key: TOKEN_KEY } });
  const v = s?.value as { hash?: string; createdAt?: string; last4?: string } | undefined;
  return v?.hash ? { createdAt: v.createdAt ?? "", last4: v.last4 ?? "" } : null;
}

// Gera uma chave nova (a antiga deixa de valer). Só é mostrada uma vez.
export async function rotateToken(db: Db, actor: SessionUser): Promise<string> {
  const token = `hotel_${randomBytes(24).toString("base64url")}`;
  const value = { hash: sha(token), createdAt: new Date().toISOString(), last4: token.slice(-4) };
  await db.setting.upsert({ where: { key: TOKEN_KEY }, update: { value }, create: { key: TOKEN_KEY, value } });
  await audit(db, "integration.token", { userId: actor.id });
  return token;
}

export async function revokeToken(db: Db, actor: SessionUser) {
  await db.setting.deleteMany({ where: { key: TOKEN_KEY } });
  await audit(db, "integration.token.revoked", { userId: actor.id });
}

export async function checkToken(db: Db, header: string | null): Promise<boolean> {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return false;
  const s = await db.setting.findUnique({ where: { key: TOKEN_KEY } });
  const hash = (s?.value as { hash?: string } | undefined)?.hash;
  if (!hash) return false;
  const a = Buffer.from(sha(token));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

const dateStr = z.string().refine(isDateStr, "Data inválida (use AAAA-MM-DD).");

// Formato que o channel manager envia (JSON).
export const apiReservationSchema = z
  .object({
    source: z.enum(SOURCES).default("OUTRO"),
    externalCode: z.string().trim().min(1).max(40),
    status: z.enum(["confirmed", "modified", "cancelled"]).default("confirmed"),
    guest: z.object({
      fullName: z.string().trim().min(3).max(120),
      email: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(30).optional(),
      country: z.string().trim().max(40).optional(),
    }),
    checkIn: dateStr,
    checkOut: dateStr,
    roomType: z.string().trim().min(1).max(80),
    adults: z.coerce.number().int().min(1).max(20).default(1),
    children: z.coerce.number().int().min(0).max(20).default(0),
    totalCents: z.coerce.number().int().min(0).optional(),
    breakfast: z.boolean().default(false),
    chargeIss: z.boolean().default(false),
    issPercent: z.coerce.number().min(0).max(20).default(5),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, { path: ["checkOut"], message: "A saída precisa ser depois da entrada." });

export async function applyApiReservation(db: Db, input: unknown) {
  const parsed = apiReservationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const p = parsed.data;
  const types = await db.roomType.findMany({ select: { id: true, name: true } });
  const roomTypeId = types.find((t) => t.id === p.roomType)?.id ?? guessRoomType(p.roomType, types);
  const actor = await integrationActor(db);
  const r: ExternalReservation = {
    externalCode: p.externalCode,
    cancelled: p.status === "cancelled",
    guestName: p.guest.fullName,
    email: p.guest.email ?? null,
    phone: p.guest.phone ?? null,
    country: p.guest.country ?? null,
    checkIn: p.checkIn,
    checkOut: p.checkOut,
    adults: p.adults,
    children: p.children,
    roomTypeLabel: p.roomType,
    totalCents: p.totalCents ?? null,
    rooms: 1,
    notes: p.notes ?? null,
  };
  const result = await applyExternal(db, actor, p.source, r, roomTypeId, { breakfast: p.breakfast, chargeIss: p.chargeIss, issPercent: p.issPercent });
  const ok = result.action !== "erro";
  return { ok, status: ok ? 200 : 409, ...result };
}

// Disponibilidade por tipo e noite (para o channel manager fechar vendas).
export async function availabilityForApi(db: Db, from: DateStr, to: DateStr) {
  const list = await availability(db, from, to);
  const nights = list[0]?.byNight.length ?? 0;
  const dates = Array.from({ length: nights }, (_, i) => addDays(from, i));
  return list.map((t) => ({
    roomTypeId: t.roomTypeId,
    roomType: t.name,
    capacity: t.capacity,
    totalRooms: t.total,
    nights: t.byNight.map((free, i) => ({ date: dates[i], free })),
  }));
}

// Escolhas de "tipo do portal → tipo do hotel", lembradas por portal.
const MAP_KEY = "importTypeMap";

export async function savedTypeMap(db: Db, source: Source): Promise<Record<string, string>> {
  const s = await db.setting.findUnique({ where: { key: MAP_KEY } });
  return ((s?.value as Record<string, Record<string, string>> | undefined) ?? {})[source] ?? {};
}

export async function rememberTypeMap(db: Db, source: Source, map: Record<string, string>) {
  const s = await db.setting.findUnique({ where: { key: MAP_KEY } });
  const all = (s?.value as Record<string, Record<string, string>> | undefined) ?? {};
  const clean = Object.fromEntries(Object.entries(map).filter(([, v]) => v));
  const value = { ...all, [source]: { ...(all[source] ?? {}), ...clean } };
  await db.setting.upsert({ where: { key: MAP_KEY }, update: { value }, create: { key: MAP_KEY, value } });
}
