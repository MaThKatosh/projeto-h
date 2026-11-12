"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { rotateRoomToken } from "@/lib/requests/service";

export async function rotateQrAction(roomId: string) {
  const { user } = await requirePermission("rooms.manage");
  await getDb().$transaction((tx) => rotateRoomToken(tx, user, roomId));
  revalidatePath("/quartos/qr");
}
