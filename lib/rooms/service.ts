import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { audit } from "@/lib/audit";
import type { Db } from "@/lib/db-types";
import { fieldErrors } from "@/lib/auth/validation";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { can } from "@/lib/permissions";
import type { Housekeeping, Maintenance, Occupancy } from "@/lib/rooms/status";
import { blockReason, canChangeStatus, cleaningBlockedReason, statusChangeSchema } from "@/lib/rooms/rules";
import { deriveMaintenance, OPEN_STATUSES } from "@/lib/maintenance/rules";
import { syncCleaningTask } from "@/lib/housekeeping/tasks";
import type { Role } from "@/lib/permissions";

// ================================================================
// SERVIÇO DE QUARTOS
// ================================================================

// O que o mapa recebe de cada quarto (também vai nos avisos em tempo
// real, então nada sensível aqui).
export type RoomView = {
  id: string;
  number: string;
  floor: number;
  typeName: string;
  occupancy: Occupancy;
  housekeeping: Housekeeping;
  maintenance: Maintenance;
  note: string | null;
  active: boolean;
  updatedAt: string;
};

const roomSelect = {
  id: true,
  number: true,
  floor: true,
  occupancy: true,
  housekeeping: true,
  maintenance: true,
  note: true,
  active: true,
  updatedAt: true,
  roomType: { select: { name: true } },
} as const;

type RoomRow = Prisma.RoomGetPayload<{ select: typeof roomSelect }>;

function toView(row: RoomRow): RoomView {
  const { roomType, updatedAt, ...rest } = row;
  return { ...rest, typeName: roomType.name, updatedAt: updatedAt.toISOString() };
}

// Ordena "101" < "102" < "1010" e "204A" depois de "204".
export function compareRoomNumbers(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { numeric: true });
}

export async function listRooms(db: Db, options: { includeInactive?: boolean } = {}): Promise<RoomView[]> {
  const rows = await db.room.findMany({
    where: options.includeInactive ? {} : { active: true },
    select: roomSelect,
  });
  return rows
    .map(toView)
    .sort((a, b) => a.floor - b.floor || compareRoomNumbers(a.number, b.number));
}

export async function getRoomHistory(db: Db, roomId: string, take = 15) {
  const rows = await db.roomStatusLog.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      field: true,
      fromValue: true,
      toValue: true,
      createdAt: true,
      user: { select: { fullName: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    field: r.field,
    fromValue: r.fromValue,
    toValue: r.toValue,
    createdAt: r.createdAt.toISOString(),
    userName: r.user?.fullName ?? "Sistema",
  }));
}

export type RoomHistoryEntry = Awaited<ReturnType<typeof getRoomHistory>>[number];

// ----------------------------------------------------------------
// MUDANÇA DE SITUAÇÃO
// ----------------------------------------------------------------

export async function changeRoomStatus(
  db: Db,
  actor: SessionUser,
  roomId: string,
  input: unknown
): Promise<{ ok: true; room: RoomView } | Failure> {
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mudança inválida." };
  }
  const change = parsed.data;

  const current = await db.room.findUnique({
    where: { id: roomId },
    select: { id: true, active: true, occupancy: true, housekeeping: true, maintenance: true },
  });
  if (!current || !current.active) return { ok: false, error: "Quarto não encontrado." };

  if (!canChangeStatus(actor.role, current, change)) {
    return { ok: false, error: "Seu cargo não pode fazer esta mudança." };
  }
  const reason =
    blockReason(current, change) ??
    (change.field === "housekeeping" && change.value !== "SUJO" ? cleaningBlockedReason(current.maintenance) : null);
  if (reason) return { ok: false, error: reason };

  let patch: RoomPatch;
  if (change.field === "maintenance") {
    // Desbloquear: a situação volta a sair das ocorrências abertas.
    patch = {
      maintenance: change.value === "BLOQUEADO" ? "BLOQUEADO" : await derivedMaintenance(db, roomId, "OK"),
    };
  } else if (change.field === "note") {
    patch = { note: change.value || null };
  } else {
    patch = { housekeeping: change.value };
  }

  return { ok: true, room: await applyRoomChanges(db, actor, roomId, patch) };
}

export type RoomPatch = {
  occupancy?: Occupancy;
  housekeeping?: Housekeeping;
  maintenance?: Maintenance;
  note?: string | null;
};

// Situação de manutenção calculada a partir das ocorrências abertas.
export async function derivedMaintenance(db: Db, roomId: string, base: Maintenance): Promise<Maintenance> {
  const tickets = await db.maintenanceTicket.findMany({
    where: { roomId, status: { in: OPEN_STATUSES } },
    select: { status: true, outOfOrder: true },
  });
  return deriveMaintenance(base, tickets);
}

// ÚNICO lugar que grava a situação de um quarto. Registra o histórico e
// mantém tudo interligado:
//  - quarto que sai da manutenção/bloqueio volta SUJO;
//  - mudança de limpeza abre/começa/fecha a tarefa da governança.
export async function applyRoomChanges(
  db: Db,
  actor: { id: string; role: Role } | null,
  roomId: string,
  patch: RoomPatch
): Promise<RoomView> {
  const current = await db.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { occupancy: true, housekeeping: true, maintenance: true, note: true },
  });

  const next = { ...current, ...patch };

  if (
    patch.maintenance !== undefined &&
    (current.maintenance === "EM_MANUTENCAO" || current.maintenance === "BLOQUEADO") &&
    (next.maintenance === "OK" || next.maintenance === "COM_PROBLEMA") &&
    patch.housekeeping === undefined
  ) {
    next.housekeeping = "SUJO";
  }

  const fields = ["occupancy", "housekeeping", "maintenance", "note"] as const;
  const changed = fields.filter((f) => current[f] !== next[f]);

  if (changed.length === 0) {
    const room = await db.room.findUniqueOrThrow({ where: { id: roomId }, select: roomSelect });
    return toView(room);
  }

  const data: Prisma.RoomUpdateInput = {};
  for (const f of changed) (data as Record<string, unknown>)[f] = next[f];

  const room = await db.room.update({ where: { id: roomId }, data, select: roomSelect });
  await db.roomStatusLog.createMany({
    data: changed.map((f) => ({
      roomId,
      userId: actor?.id ?? null,
      field: f,
      fromValue: current[f],
      toValue: next[f],
    })),
  });

  if (changed.includes("housekeeping")) {
    await syncCleaningTask(db, roomId, next.housekeeping, actor);
  }

  return toView(room);
}

// ----------------------------------------------------------------
// CADASTRO DE TIPOS E QUARTOS
// ----------------------------------------------------------------

const roomTypeSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do tipo.").max(50, "Nome longo demais."),
  capacity: z.coerce.number().int().min(1, "Mínimo 1 pessoa.").max(20, "Máximo 20 pessoas."),
  description: z.string().trim().max(200).optional().transform((v) => v || null),
});

const roomNumber = z
  .string()
  .trim()
  .min(1, "Informe o número.")
  .max(10, "Número longo demais.")
  .regex(/^[0-9A-Za-z-]+$/, "Use só números, letras e hífen.");

const roomSchema = z.object({
  number: roomNumber,
  floor: z.coerce.number().int().min(-5, "Andar inválido.").max(200, "Andar inválido."),
  roomTypeId: z.uuid("Escolha o tipo."),
});

const roomUpdateSchema = roomSchema.extend({ active: z.boolean() });

const roomRangeSchema = z
  .object({
    floor: z.coerce.number().int().min(-5).max(200),
    from: z.coerce.number().int().min(1, "Número inicial inválido.").max(99999),
    to: z.coerce.number().int().min(1, "Número final inválido.").max(99999),
    roomTypeId: z.uuid("Escolha o tipo."),
  })
  .refine((d) => d.to >= d.from, { path: ["to"], message: "O final precisa ser maior ou igual ao início." })
  .refine((d) => d.to - d.from < 100, { path: ["to"], message: "No máximo 100 quartos de uma vez." });

function denied(actor: SessionUser): Failure | null {
  return can(actor.role, "rooms.manage") ? null : { ok: false, error: "Seu cargo não pode cadastrar quartos." };
}

function invalid(error: z.ZodError): Failure {
  return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(error) };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createRoomType(db: Db, actor: SessionUser, input: unknown): Promise<{ ok: true } | Failure> {
  const no = denied(actor);
  if (no) return no;
  const parsed = roomTypeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const type = await db.roomType.create({ data: parsed.data });
    await audit(db, "roomType.created", { userId: actor.id, metadata: { id: type.id, name: type.name } });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "Revise os campos destacados.", fieldErrors: { name: ["Já existe um tipo com esse nome."] } };
    }
    throw error;
  }
}

export async function updateRoomType(
  db: Db,
  actor: SessionUser,
  id: string,
  input: unknown
): Promise<{ ok: true } | Failure> {
  const no = denied(actor);
  if (no) return no;
  const parsed = roomTypeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await db.roomType.update({ where: { id }, data: parsed.data });
    await audit(db, "roomType.updated", { userId: actor.id, metadata: { id } });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "Revise os campos destacados.", fieldErrors: { name: ["Já existe um tipo com esse nome."] } };
    }
    throw error;
  }
}

export async function createRoomRange(
  db: Db,
  actor: SessionUser,
  input: unknown
): Promise<{ ok: true; created: string[]; skipped: string[] } | Failure> {
  const no = denied(actor);
  if (no) return no;
  const parsed = roomRangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { floor, from, to, roomTypeId } = parsed.data;

  if (!(await db.roomType.findUnique({ where: { id: roomTypeId }, select: { id: true } }))) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: { roomTypeId: ["Tipo não encontrado."] } };
  }

  const wanted = Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  const existing = new Set(
    (await db.room.findMany({ where: { number: { in: wanted } }, select: { number: true } })).map((r) => r.number)
  );
  const created = wanted.filter((n) => !existing.has(n));

  await db.room.createMany({
    data: created.map((number) => ({ number, floor, roomTypeId })),
    skipDuplicates: true,
  });
  await audit(db, "room.created", { userId: actor.id, metadata: { numbers: created } });

  return { ok: true, created, skipped: wanted.filter((n) => existing.has(n)) };
}

export async function updateRoom(
  db: Db,
  actor: SessionUser,
  id: string,
  input: unknown
): Promise<{ ok: true } | Failure> {
  const no = denied(actor);
  if (no) return no;
  const parsed = roomUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const current = await db.room.findUnique({ where: { id }, select: { occupancy: true, active: true } });
  if (!current) return { ok: false, error: "Quarto não encontrado." };
  if (!parsed.data.active && current.occupancy === "OCUPADO") {
    return { ok: false, error: "Não é possível desativar um quarto ocupado." };
  }

  try {
    await db.room.update({ where: { id }, data: parsed.data });
    await audit(db, "room.updated", { userId: actor.id, metadata: { id, ...parsed.data } });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "Revise os campos destacados.", fieldErrors: { number: ["Já existe um quarto com esse número."] } };
    }
    throw error;
  }
}

export async function getRoomView(db: Db, id: string): Promise<RoomView | null> {
  const row = await db.room.findUnique({ where: { id }, select: roomSelect });
  return row ? toView(row) : null;
}
