"use server";

import { getDb } from "@/lib/db";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { publish } from "@/lib/realtime";
import { createTicket, getTicket, ticketAction, type TicketDetail } from "@/lib/maintenance/service";
import type { FieldErrors } from "@/lib/auth/validation";

export type CreateTicketState =
  | { error?: string; fieldErrors?: FieldErrors; success?: string; at?: number }
  | undefined;

export async function createTicketAction(_prev: CreateTicketState, form: FormData): Promise<CreateTicketState> {
  const { user } = await verifySession();
  const result = await getDb().$transaction((tx) =>
    createTicket(tx, user, {
      roomId: String(form.get("roomId") ?? ""),
      location: String(form.get("location") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      priority: String(form.get("priority") ?? "MEDIA"),
      outOfOrder: form.get("outOfOrder") === "on",
    })
  );
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };

  if (result.room) await publish({ type: "room.updated", room: result.room, by: user.fullName });
  await publish({ type: "maintenance.changed" });
  return { success: `Ocorrência nº ${result.number} aberta. A manutenção já está vendo.`, at: Date.now() };
}

export async function ticketActionAction(ticketId: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const { user } = await verifySession();
  if (typeof ticketId !== "string") return { ok: false, error: "Ocorrência inválida." };

  const result = await getDb().$transaction((tx) => ticketAction(tx, user, ticketId, input));
  if (!result.ok) return { ok: false, error: result.error };

  if (result.room) await publish({ type: "room.updated", room: result.room, by: user.fullName });
  await publish({ type: "maintenance.changed" });
  return { ok: true };
}

export async function ticketDetailAction(ticketId: string): Promise<TicketDetail | null> {
  const { user } = await verifySession();
  if (!can(user.role, "maintenance.view") || typeof ticketId !== "string") return null;
  return getTicket(getDb(), ticketId);
}
