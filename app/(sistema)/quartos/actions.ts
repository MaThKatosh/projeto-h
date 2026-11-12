"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { publish } from "@/lib/realtime";
import { createRoomRange, createRoomType, updateRoom, updateRoomType } from "@/lib/rooms/service";
import type { FieldErrors } from "@/lib/auth/validation";

export type FormState = { error?: string; success?: string; fieldErrors?: FieldErrors } | undefined;

async function done(success: string): Promise<FormState> {
  revalidatePath("/quartos");
  revalidatePath("/mapa");
  await publish({ type: "rooms.changed" });
  return { success };
}

export async function createRoomTypeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePermission("rooms.manage");
  const result = await createRoomType(getDb(), user, Object.fromEntries(form));
  return result.ok ? done("Tipo de quarto criado.") : result;
}

export async function updateRoomTypeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePermission("rooms.manage");
  const result = await updateRoomType(getDb(), user, String(form.get("id")), Object.fromEntries(form));
  return result.ok ? done("Tipo de quarto salvo.") : result;
}

export async function createRoomRangeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePermission("rooms.manage");
  const result = await createRoomRange(getDb(), user, Object.fromEntries(form));
  if (!result.ok) return result;
  const parts = [];
  if (result.created.length) parts.push(`${result.created.length} quarto(s) criado(s)`);
  if (result.skipped.length) parts.push(`já existiam: ${result.skipped.join(", ")}`);
  return done(parts.join(" · ") || "Nada a criar.");
}

export async function updateRoomAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePermission("rooms.manage");
  const result = await updateRoom(getDb(), user, String(form.get("id")), {
    number: form.get("number"),
    floor: form.get("floor"),
    roomTypeId: form.get("roomTypeId"),
    active: form.get("active") === "on",
  });
  return result.ok ? done("Quarto salvo.") : result;
}
