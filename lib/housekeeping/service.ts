import { z } from "zod";
import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { can } from "@/lib/permissions";
import { cleaningBlockedReason } from "@/lib/rooms/rules";
import { applyRoomChanges, compareRoomNumbers, type RoomView } from "@/lib/rooms/service";
import type { Maintenance, Occupancy } from "@/lib/rooms/status";
import { getBusinessDate } from "@/lib/hotel-date";
import { fromDateStr } from "@/lib/dates";

// ================================================================
// PAINEL DA GOVERNANÇA
// ================================================================

export type CleaningCard = {
  id: string;
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";
  priority: boolean;
  arrivingToday: boolean; // hóspede chega hoje neste quarto
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  finishedByName: string | null;
  room: { id: string; number: string; floor: number; typeName: string; occupancy: Occupancy; maintenance: Maintenance };
};

export type HousekeepingBoard = {
  open: CleaningCard[];
  doneToday: CleaningCard[];
  staff: { id: string; fullName: string }[];
  avgMinutesToday: number | null;
  generatedAt: number; // hora do servidor (para "há X min")
};

export function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

const cardSelect = {
  id: true,
  status: true,
  priority: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  assignedToId: true,
  assignedTo: { select: { fullName: true } },
  finishedBy: { select: { fullName: true } },
  room: {
    select: {
      id: true,
      number: true,
      floor: true,
      occupancy: true,
      maintenance: true,
      roomType: { select: { name: true } },
    },
  },
} as const;

type Row = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows(db: Db, where: object) {
  return db.cleaningTask.findMany({ where, select: cardSelect });
}

function toCard(r: Row): CleaningCard {
  return {
    id: r.id,
    status: r.status as CleaningCard["status"],
    priority: r.priority,
    arrivingToday: false,
    createdAt: r.createdAt.toISOString(),
    startedAt: r.startedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
    assignedToId: r.assignedToId,
    assignedToName: r.assignedTo?.fullName ?? null,
    finishedByName: r.finishedBy?.fullName ?? null,
    room: {
      id: r.room.id,
      number: r.room.number,
      floor: r.room.floor,
      typeName: r.room.roomType.name,
      occupancy: r.room.occupancy,
      maintenance: r.room.maintenance,
    },
  };
}

// Ordem de trabalho: prioridade (marcada ou hóspede chegando hoje) primeiro; depois quarto LIVRE (pode ser
// vendido assim que ficar limpo); depois o que espera há mais tempo.
export function compareCleaning(a: CleaningCard, b: CleaningCard) {
  const ua = a.priority || a.arrivingToday;
  const ub = b.priority || b.arrivingToday;
  if (ua !== ub) return ua ? -1 : 1;
  const aFree = a.room.occupancy === "LIVRE";
  const bFree = b.room.occupancy === "LIVRE";
  if (aFree !== bFree) return aFree ? -1 : 1;
  return a.createdAt.localeCompare(b.createdAt) || compareRoomNumbers(a.room.number, b.room.number);
}

export async function getHousekeepingBoard(db: Db, now = new Date()): Promise<HousekeepingBoard> {
  const today = fromDateStr(await getBusinessDate(db));
  const [open, done, staff, arrivals] = await Promise.all([
    loadRows(db, { status: { in: ["PENDENTE", "EM_ANDAMENTO"] }, room: { active: true } }),
    loadRows(db, { status: "CONCLUIDA", finishedAt: { gte: startOfToday(now) } }),
    db.user.findMany({
      where: { role: "GOVERNANCA", active: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    db.reservation.findMany({
      where: { status: "CONFIRMADA", roomId: { not: null }, checkIn: { lte: today } },
      select: { roomId: true },
    }),
  ]);
  const arriving = new Set(arrivals.map((a) => a.roomId));

  const doneToday = done.map(toCard).sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  const durations = doneToday
    .filter((c) => c.startedAt && c.finishedAt)
    .map((c) => (Date.parse(c.finishedAt!) - Date.parse(c.startedAt!)) / 60000);

  return {
    generatedAt: now.getTime(),
    open: open.map((r) => ({ ...toCard(r), arrivingToday: arriving.has(r.room.id) })).sort(compareCleaning),
    doneToday,
    staff,
    avgMinutesToday: durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null,
  };
}

// ----------------------------------------------------------------
// AÇÕES
// ----------------------------------------------------------------

export const cleaningActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("comecar") }),
  z.object({ action: z.literal("terminar") }),
  z.object({ action: z.literal("devolver") }), // parou no meio: volta para "para arrumar"
  z.object({ action: z.literal("pegar") }), // eu vou arrumar este
  z.object({ action: z.literal("atribuir"), userId: z.uuid().nullable() }),
  z.object({ action: z.literal("prioridade"), value: z.boolean() }),
]);

export async function cleaningAction(
  db: Db,
  actor: SessionUser,
  taskId: string,
  input: unknown
): Promise<{ ok: true; room: RoomView | null } | Failure> {
  const parsed = cleaningActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ação inválida." };
  const act = parsed.data;

  const task = await db.cleaningTask.findUnique({
    where: { id: taskId },
    select: { id: true, status: true, roomId: true, assignedToId: true, room: { select: { maintenance: true } } },
  });
  if (!task || (task.status !== "PENDENTE" && task.status !== "EM_ANDAMENTO")) {
    return { ok: false, error: "Esta tarefa já foi encerrada. A tela vai se atualizar." };
  }

  const needs = act.action === "atribuir" || act.action === "prioridade" ? "housekeeping.assign" : "rooms.housekeeping";
  if (!can(actor.role, needs)) return { ok: false, error: "Seu cargo não pode fazer isso." };

  switch (act.action) {
    case "comecar": {
      if (task.status !== "PENDENTE") return { ok: false, error: "Este quarto já está sendo arrumado." };
      const blocked = cleaningBlockedReason(task.room.maintenance);
      if (blocked) return { ok: false, error: blocked };
      return { ok: true, room: await applyRoomChanges(db, actor, task.roomId, { housekeeping: "EM_ARRUMACAO" }) };
    }
    case "terminar": {
      const blocked = cleaningBlockedReason(task.room.maintenance);
      if (blocked) return { ok: false, error: blocked };
      return { ok: true, room: await applyRoomChanges(db, actor, task.roomId, { housekeeping: "LIMPO" }) };
    }
    case "devolver":
      if (task.status !== "EM_ANDAMENTO") return { ok: false, error: "Este quarto não está em arrumação." };
      return { ok: true, room: await applyRoomChanges(db, actor, task.roomId, { housekeeping: "SUJO" }) };
    case "pegar":
      if (task.assignedToId && task.assignedToId !== actor.id) {
        return { ok: false, error: "Este quarto já tem outra pessoa responsável." };
      }
      await db.cleaningTask.update({ where: { id: taskId }, data: { assignedToId: actor.id } });
      return { ok: true, room: null };
    case "atribuir": {
      if (act.userId) {
        const target = await db.user.findUnique({ where: { id: act.userId }, select: { role: true, active: true } });
        if (!target?.active || target.role !== "GOVERNANCA") {
          return { ok: false, error: "Escolha alguém ativo da governança." };
        }
      }
      await db.cleaningTask.update({ where: { id: taskId }, data: { assignedToId: act.userId } });
      return { ok: true, room: null };
    }
    case "prioridade":
      await db.cleaningTask.update({ where: { id: taskId }, data: { priority: act.value } });
      return { ok: true, room: null };
  }
}
