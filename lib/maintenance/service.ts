import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { fieldErrors } from "@/lib/auth/validation";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { applyRoomChanges, derivedMaintenance, type RoomView } from "@/lib/rooms/service";
import {
  canDo,
  createTicketSchema,
  OPEN_STATUSES,
  PRIORITY,
  ticketActionSchema,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/maintenance/rules";

// ================================================================
// OCORRÊNCIAS DE MANUTENÇÃO
// ================================================================

export type TicketCard = {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  outOfOrder: boolean;
  place: string; // "Quarto 104" ou o local
  roomId: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  reportedByName: string | null;
  createdAt: string;
  closedAt: string | null;
};

export type TicketDetail = TicketCard & {
  description: string | null;
  resolution: string | null;
  events: { id: string; type: string; message: string | null; userName: string; createdAt: string }[];
};

const cardSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  priority: true,
  outOfOrder: true,
  location: true,
  roomId: true,
  assignedToId: true,
  createdAt: true,
  closedAt: true,
  room: { select: { number: true } },
  assignedTo: { select: { fullName: true } },
  reportedBy: { select: { fullName: true } },
} as const;

type CardRow = Awaited<ReturnType<typeof findCards>>[number];

function findCards(db: Db, where: object, take?: number) {
  return db.maintenanceTicket.findMany({ where, select: cardSelect, orderBy: { closedAt: "desc" }, take });
}

function toCard(r: CardRow): TicketCard {
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    status: r.status,
    priority: r.priority,
    outOfOrder: r.outOfOrder,
    place: r.room ? `Quarto ${r.room.number}` : (r.location ?? "—"),
    roomId: r.roomId,
    assignedToId: r.assignedToId,
    assignedToName: r.assignedTo?.fullName ?? null,
    reportedByName: r.reportedBy?.fullName ?? null,
    createdAt: r.createdAt.toISOString(),
    closedAt: r.closedAt?.toISOString() ?? null,
  };
}

// Mais urgente primeiro; empate: a mais antiga.
export function compareTickets(a: TicketCard, b: TicketCard) {
  return PRIORITY[a.priority].order - PRIORITY[b.priority].order || a.createdAt.localeCompare(b.createdAt);
}

export async function getMaintenanceBoard(db: Db, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [open, closed, staff] = await Promise.all([
    findCards(db, { status: { in: OPEN_STATUSES } }),
    findCards(db, { status: { in: ["RESOLVIDA", "CANCELADA"] }, closedAt: { gte: weekAgo } }, 30),
    db.user.findMany({
      where: { role: "MANUTENCAO", active: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  return { open: open.map(toCard).sort(compareTickets), closed: closed.map(toCard), staff, generatedAt: now.getTime() };
}

export async function getTicket(db: Db, id: string): Promise<TicketDetail | null> {
  const row = await db.maintenanceTicket.findUnique({
    where: { id },
    select: {
      ...cardSelect,
      description: true,
      resolution: true,
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, message: true, createdAt: true, user: { select: { fullName: true } } },
      },
    },
  });
  if (!row) return null;
  return {
    ...toCard(row),
    description: row.description,
    resolution: row.resolution,
    events: row.events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      userName: e.user?.fullName ?? "Sistema",
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function openTicketsForRoom(db: Db, roomId: string) {
  return (await findCards(db, { roomId, status: { in: OPEN_STATUSES } })).map(toCard).sort(compareTickets);
}

// Recalcula a situação de manutenção do quarto depois de mexer numa
// ocorrência dele. Devolve o quarto se algo mudou (para o aviso ao vivo).
async function refreshRoom(db: Db, actor: SessionUser, roomId: string | null): Promise<RoomView | null> {
  if (!roomId) return null;
  const room = await db.room.findUnique({ where: { id: roomId }, select: { maintenance: true } });
  if (!room) return null;
  const base = room.maintenance === "BLOQUEADO" ? "BLOQUEADO" : "OK";
  const next = await derivedMaintenance(db, roomId, base);
  if (next === room.maintenance) return null;
  return applyRoomChanges(db, actor, roomId, { maintenance: next });
}

// ----------------------------------------------------------------
// CRIAR
// ----------------------------------------------------------------

export async function createTicket(
  db: Db,
  actor: SessionUser,
  input: unknown
): Promise<{ ok: true; id: string; number: number; room: RoomView | null } | Failure> {
  if (!can(actor.role, "rooms.reportProblem")) return { ok: false, error: "Seu cargo não pode abrir ocorrências." };

  const parsed = createTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  if (data.roomId) {
    const room = await db.room.findUnique({ where: { id: data.roomId }, select: { active: true } });
    if (!room?.active) return { ok: false, error: "Quarto não encontrado." };
  }

  const ticket = await db.maintenanceTicket.create({
    data: {
      roomId: data.roomId ?? null,
      location: data.roomId ? null : data.location,
      title: data.title,
      description: data.description,
      priority: data.priority,
      outOfOrder: data.outOfOrder,
      reportedById: actor.id,
      events: { create: { type: "criada", userId: actor.id, message: data.description } },
    },
    select: { id: true, number: true },
  });
  await audit(db, "ticket.created", { userId: actor.id, metadata: { number: ticket.number } });

  return { ok: true, ...ticket, room: await refreshRoom(db, actor, data.roomId ?? null) };
}

// ----------------------------------------------------------------
// AÇÕES
// ----------------------------------------------------------------

export async function ticketAction(
  db: Db,
  actor: SessionUser,
  ticketId: string,
  input: unknown
): Promise<{ ok: true; room: RoomView | null } | Failure> {
  const parsed = ticketActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ação inválida." };
  const act = parsed.data;

  const ticket = await db.maintenanceTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, roomId: true, assignedToId: true, outOfOrder: true },
  });
  if (!ticket) return { ok: false, error: "Ocorrência não encontrada." };

  const permission =
    act.action === "comentar" ? "maintenance.view" : act.action === "cancelar" ? "maintenance.cancel" : "rooms.maintenance";
  if (!can(actor.role, permission)) return { ok: false, error: "Seu cargo não pode fazer isso." };

  if (act.action in { assumir: 1, iniciar: 1, aguardar: 1, resolver: 1, reabrir: 1, cancelar: 1 }) {
    if (!canDo(act.action as Parameters<typeof canDo>[0], ticket.status)) {
      return { ok: false, error: "Esta ação não vale para a situação atual da ocorrência." };
    }
  }
  const closed = ticket.status === "RESOLVIDA" || ticket.status === "CANCELADA";
  if (closed && (act.action === "atribuir" || act.action === "foraDeVenda" || act.action === "prioridade")) {
    return { ok: false, error: "Ocorrência encerrada. Reabra para alterar." };
  }

  const now = new Date();
  const event = async (type: string, message?: string | null) =>
    db.ticketEvent.create({ data: { ticketId, userId: actor.id, type, message: message ?? null } });
  const update = (data: object) => db.maintenanceTicket.update({ where: { id: ticketId }, data });

  switch (act.action) {
    case "assumir":
      await update({ assignedToId: actor.id });
      await event("atribuida", `Assumida por ${actor.fullName}`);
      break;
    case "atribuir": {
      let name = "ninguém";
      if (act.userId) {
        const target = await db.user.findUnique({ where: { id: act.userId }, select: { role: true, active: true, fullName: true } });
        if (!target?.active || target.role !== "MANUTENCAO") return { ok: false, error: "Escolha alguém ativo da manutenção." };
        name = target.fullName;
      }
      await update({ assignedToId: act.userId });
      await event("atribuida", `Responsável: ${name}`);
      break;
    }
    case "iniciar":
      await update({ status: "EM_ANDAMENTO", startedAt: now, assignedToId: ticket.assignedToId ?? actor.id });
      await event("iniciada");
      break;
    case "aguardar":
      await update({ status: "AGUARDANDO" });
      await event("aguardando", act.message);
      break;
    case "resolver":
      await update({ status: "RESOLVIDA", resolution: act.message, closedAt: now });
      await event("resolvida", act.message);
      break;
    case "reabrir":
      await update({ status: "ABERTA", closedAt: null, resolution: null });
      await event("reaberta", act.message);
      break;
    case "cancelar":
      await update({ status: "CANCELADA", closedAt: now });
      await event("cancelada", act.message);
      break;
    case "comentar":
      await event("comentario", act.message);
      break;
    case "foraDeVenda":
      if (act.value && !ticket.roomId) return { ok: false, error: "Só um quarto pode ficar fora de venda." };
      if (act.value === ticket.outOfOrder) return { ok: true, room: null };
      await update({ outOfOrder: act.value });
      await event("fora_de_venda", act.value ? "Quarto tirado de venda" : "Quarto pode voltar a ser vendido");
      break;
    case "prioridade":
      await update({ priority: act.value });
      await event("prioridade", `Prioridade: ${PRIORITY[act.value].label}`);
      break;
  }

  await audit(db, `ticket.${act.action}`, { userId: actor.id, metadata: { ticketId } });
  return { ok: true, room: await refreshRoom(db, actor, ticket.roomId) };
}
