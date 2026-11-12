import type { Db } from "@/lib/db-types";
import type { Role } from "@/lib/permissions";
import type { Housekeeping } from "@/lib/rooms/status";

// ================================================================
// TAREFA DE LIMPEZA ACOMPANHA A SITUAÇÃO DO QUARTO
// ================================================================
//
// Chamado por applyRoomChanges sempre que a limpeza de um quarto muda,
// venha a mudança do mapa, do painel da governança ou da manutenção:
//   SUJO          → existe uma tarefa PENDENTE
//   EM_ARRUMACAO  → a tarefa está EM_ANDAMENTO (começou agora)
//   LIMPO         → a tarefa foi CONCLUÍDA (quem terminou, quando)
// Quem é da governança e mexe numa tarefa sem responsável vira o
// responsável dela.

const OPEN = ["PENDENTE", "EM_ANDAMENTO"] as const;

export async function syncCleaningTask(
  db: Db,
  roomId: string,
  housekeeping: Housekeeping,
  actor: { id: string; role: Role } | null,
  now = new Date()
) {
  const open = await db.cleaningTask.findFirst({
    where: { roomId, status: { in: [...OPEN] } },
    select: { id: true, status: true, assignedToId: true, startedAt: true },
  });
  const selfAssign = actor?.role === "GOVERNANCA" ? actor.id : null;

  switch (housekeeping) {
    case "SUJO":
      if (!open) {
        await db.cleaningTask.create({ data: { roomId } });
      } else if (open.status === "EM_ANDAMENTO") {
        await db.cleaningTask.update({ where: { id: open.id }, data: { status: "PENDENTE", startedAt: null } });
      }
      return;

    case "EM_ARRUMACAO":
      if (!open) {
        await db.cleaningTask.create({
          data: { roomId, status: "EM_ANDAMENTO", startedAt: now, assignedToId: selfAssign },
        });
      } else {
        await db.cleaningTask.update({
          where: { id: open.id },
          data: { status: "EM_ANDAMENTO", startedAt: now, assignedToId: open.assignedToId ?? selfAssign },
        });
      }
      return;

    case "LIMPO":
      if (open) {
        await db.cleaningTask.update({
          where: { id: open.id },
          data: {
            status: "CONCLUIDA",
            finishedAt: now,
            finishedById: actor?.id ?? null,
            assignedToId: open.assignedToId ?? selfAssign,
          },
        });
      }
      return;
  }
}
