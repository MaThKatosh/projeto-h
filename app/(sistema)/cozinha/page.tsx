import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { kitchenQueue } from "@/lib/restaurant/service";
import { KitchenBoard } from "./board";

export const dynamic = "force-dynamic";

export default async function CozinhaPage() {
  await requirePermission("kitchen.view");
  const queue = await kitchenQueue(getDb());
  // Hora do servidor: a mais recente entre os pedidos ou o início do dia.
  const serverNow = queue.reduce((max, i) => Math.max(max, Date.parse(i.createdAt)), 0);
  return <KitchenBoard items={queue} serverNow={serverNow} />;
}
