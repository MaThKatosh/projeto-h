import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { createTicket } from "@/lib/maintenance/service";
import type { RoomView } from "@/lib/rooms/service";
import { GUEST_QR_USERNAME, systemActor } from "@/lib/system-users";

// ================================================================
// PEDIDOS DOS HÓSPEDES (QR code colado no quarto)
// Só valem com o quarto ocupado; um problema vira ocorrência da manutenção.
// ================================================================

import { PROBLEM_KINDS, REQUEST_TYPES, type RequestType } from "@/lib/requests/rules";
export { PROBLEM_KINDS, REQUEST_LABEL, REQUEST_TYPES, STATUS_LABEL, type RequestType } from "@/lib/requests/rules";

// Limites contra abuso: por quarto, por hora; e o mesmo pedido repetido.
const MAX_PER_HOUR = 6;
const REPEAT_MINUTES = 10;

export async function roomToken(db: Db, roomId: string): Promise<string> {
  const room = await db.room.findUnique({ where: { id: roomId }, select: { guestToken: true } });
  if (room?.guestToken) return room.guestToken;
  const token = randomBytes(12).toString("base64url");
  await db.room.update({ where: { id: roomId }, data: { guestToken: token } });
  return token;
}

// Gera um código novo (ex.: QR antigo fotografado por alguém de fora).
export async function rotateRoomToken(db: Db, actor: SessionUser, roomId: string): Promise<string> {
  const token = randomBytes(12).toString("base64url");
  await db.room.update({ where: { id: roomId }, data: { guestToken: token } });
  await audit(db, "room.qr.rotated", { userId: actor.id, metadata: { roomId } });
  return token;
}

type GuestRoom = { roomId: string; number: string; reservationId: string | null; since: Date | null };

async function roomByToken(db: Db, token: string): Promise<GuestRoom | null> {
  if (!/^[\w-]{10,40}$/.test(token)) return null;
  const room = await db.room.findUnique({
    where: { guestToken: token },
    select: {
      id: true,
      number: true,
      active: true,
      reservations: { where: { status: "HOSPEDADA" }, select: { id: true, checkedInAt: true }, take: 1 },
    },
  });
  if (!room?.active) return null;
  const stay = room.reservations[0];
  return { roomId: room.id, number: room.number, reservationId: stay?.id ?? null, since: stay?.checkedInAt ?? null };
}

// O que a página do hóspede mostra: número do quarto e os pedidos DESTA
// estadia (nada de nome ou dados de outros hóspedes).
export async function guestPage(db: Db, token: string) {
  const room = await roomByToken(db, token);
  if (!room) return null;
  const requests = room.reservationId
    ? await db.guestRequest.findMany({
        where: { reservationId: room.reservationId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, number: true, type: true, message: true, status: true, createdAt: true },
      })
    : [];
  return { number: room.number, occupied: Boolean(room.reservationId), requests: requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
}

const createSchema = z.object({
  type: z.enum(REQUEST_TYPES),
  problem: z.enum(PROBLEM_KINDS).optional(),
  message: z.string().trim().max(500).optional().transform((v) => v || null),
});

export type CreateResult = { ok: true; number: number; ticketNumber: number | null; room: RoomView | null } | { ok: false; error: string };

export async function createGuestRequest(db: Db, token: string, input: unknown): Promise<CreateResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  const { type, problem, message } = parsed.data;
  if ((type === "OUTRO" || (type === "PROBLEMA" && problem === "Outro")) && !message) return { ok: false, error: "Conte em poucas palavras o que precisa." };

  const room = await roomByToken(db, token);
  if (!room) return { ok: false, error: "Código do quarto inválido." };
  if (!room.reservationId) return { ok: false, error: "Este quarto não está com hóspede no momento. Fale com a recepção." };

  // Um pedido de cada vez por quarto (evita duplicar com toque duplo).
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"guestreq:" + room.roomId}))`;
  const hourAgo = new Date(Date.now() - 60 * 60_000);
  const recent = await db.guestRequest.findMany({ where: { roomId: room.roomId, createdAt: { gte: hourAgo } }, select: { type: true, createdAt: true, status: true } });
  if (recent.length >= MAX_PER_HOUR) return { ok: false, error: "Muitos pedidos em pouco tempo. Se for urgente, ligue para a recepção." };
  const repeat = recent.find((r) => r.type === type && r.status !== "CONCLUIDO" && r.createdAt > new Date(Date.now() - REPEAT_MINUTES * 60_000));
  if (repeat && type !== "OUTRO") return { ok: false, error: "Já recebemos este pedido há pouco. A equipe está a caminho." };

  let ticketNumber: number | null = null;
  let changedRoom: RoomView | null = null;
  if (type === "PROBLEMA") {
    const actor = await systemActor(db, GUEST_QR_USERNAME);
    const t = await createTicket(db, actor, {
      roomId: room.roomId,
      title: `Hóspede relatou: ${problem ?? "problema"}`.slice(0, 80),
      description: message ?? undefined,
      priority: "ALTA",
    });
    if (!t.ok) return { ok: false, error: "Não foi possível registrar. Fale com a recepção." };
    ticketNumber = t.number;
    changedRoom = t.room;
  }

  const r = await db.guestRequest.create({
    data: {
      roomId: room.roomId,
      reservationId: room.reservationId,
      type,
      message: type === "PROBLEMA" ? [problem, message].filter(Boolean).join(": ") : message,
      ticketNumber,
    },
    select: { number: true },
  });
  return { ok: true, number: r.number, ticketNumber, room: changedRoom };
}

// ---------------------------------------------------------------- equipe

export type RequestView = {
  id: string;
  number: number;
  type: RequestType;
  message: string | null;
  status: "ABERTO" | "EM_ANDAMENTO" | "CONCLUIDO";
  ticketNumber: number | null;
  roomNumber: string;
  createdAt: string;
  handledByName: string | null;
  doneAt: string | null;
};

export async function listRequests(db: Db, open = true): Promise<RequestView[]> {
  const rows = await db.guestRequest.findMany({
    where: open ? { status: { not: "CONCLUIDO" } } : { createdAt: { gte: new Date(Date.now() - 2 * 86_400_000) } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 200,
    select: {
      id: true,
      number: true,
      type: true,
      message: true,
      status: true,
      ticketNumber: true,
      createdAt: true,
      doneAt: true,
      room: { select: { number: true } },
      handledBy: { select: { fullName: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    type: r.type,
    message: r.message,
    status: r.status,
    ticketNumber: r.ticketNumber,
    roomNumber: r.room.number,
    createdAt: r.createdAt.toISOString(),
    handledByName: r.handledBy?.fullName ?? null,
    doneAt: r.doneAt?.toISOString() ?? null,
  }));
}

export async function openRequestCount(db: Db): Promise<number> {
  return db.guestRequest.count({ where: { status: { not: "CONCLUIDO" } } });
}

export async function handleRequest(db: Db, actor: SessionUser, id: string, action: "atender" | "concluir"): Promise<{ ok: true } | Failure> {
  if (!can(actor.role, "requests.handle")) return { ok: false, error: "Seu cargo não atende pedidos de hóspedes." };
  const r = await db.guestRequest.findUnique({ where: { id }, select: { status: true } });
  if (!r) return { ok: false, error: "Pedido não encontrado." };
  if (r.status === "CONCLUIDO") return { ok: false, error: "Este pedido já foi concluído." };
  const now = new Date();
  await db.guestRequest.update({
    where: { id },
    data: action === "atender" ? { status: "EM_ANDAMENTO", handledById: actor.id, handledAt: now } : { status: "CONCLUIDO", doneAt: now, handledById: actor.id, handledAt: now },
  });
  return { ok: true };
}
