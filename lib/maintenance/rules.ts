import { z } from "zod";
import type { Maintenance } from "@/lib/rooms/status";

// ================================================================
// REGRAS DE MANUTENÇÃO (sem dependências do servidor)
// ================================================================

export type TicketStatus = "ABERTA" | "EM_ANDAMENTO" | "AGUARDANDO" | "RESOLVIDA" | "CANCELADA";
export type TicketPriority = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export const OPEN_STATUSES: TicketStatus[] = ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO"];

export function isOpen(status: TicketStatus) {
  return OPEN_STATUSES.includes(status);
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO: "Aguardando",
  RESOLVIDA: "Resolvida",
  CANCELADA: "Cancelada",
};

export const PRIORITY: Record<TicketPriority, { label: string; chip: string; order: number }> = {
  URGENTE: { label: "Urgente", chip: "bg-red-600 text-white", order: 0 },
  ALTA: { label: "Alta", chip: "bg-orange-500 text-white", order: 1 },
  MEDIA: { label: "Média", chip: "bg-sky-100 text-sky-800", order: 2 },
  BAIXA: { label: "Baixa", chip: "bg-zinc-200 text-zinc-700", order: 3 },
};

// Situação de manutenção do QUARTO a partir das ocorrências abertas dele.
// Bloqueio é decisão manual e tem precedência: só sai desbloqueando.
export function deriveMaintenance(
  current: Maintenance,
  tickets: { status: TicketStatus; outOfOrder: boolean }[]
): Maintenance {
  if (current === "BLOQUEADO") return "BLOQUEADO";
  const open = tickets.filter((t) => isOpen(t.status));
  if (open.some((t) => t.outOfOrder)) return "EM_MANUTENCAO";
  if (open.length > 0) return "COM_PROBLEMA";
  return "OK";
}

// Ações possíveis numa ocorrência e de qual situação cada uma parte.
export type TicketAction = "assumir" | "iniciar" | "aguardar" | "resolver" | "reabrir" | "cancelar";

export const ACTION_FROM: Record<TicketAction, TicketStatus[]> = {
  assumir: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO"],
  iniciar: ["ABERTA", "AGUARDANDO"],
  aguardar: ["ABERTA", "EM_ANDAMENTO"],
  resolver: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO"],
  reabrir: ["RESOLVIDA", "CANCELADA"],
  cancelar: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO"],
};

export function canDo(action: TicketAction, status: TicketStatus) {
  return ACTION_FROM[action].includes(status);
}

// ----------------------------------------------------------------
// Validação
// ----------------------------------------------------------------

export const createTicketSchema = z
  .object({
    roomId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    location: z.string().trim().max(60, "Local longo demais.").optional().transform((v) => v || undefined),
    title: z.string().trim().min(3, "Descreva o problema em poucas palavras.").max(80, "Título longo demais."),
    description: z.string().trim().max(1000, "Descrição longa demais.").optional().transform((v) => v || undefined),
    priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
    outOfOrder: z.boolean().default(false),
  })
  .refine((d) => d.roomId || d.location, { path: ["location"], message: "Escolha o quarto ou escreva o local." })
  .refine((d) => !d.outOfOrder || d.roomId, { path: ["outOfOrder"], message: "Só um quarto pode ficar fora de venda." });

export const ticketActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assumir") }),
  z.object({ action: z.literal("atribuir"), userId: z.uuid().nullable() }),
  z.object({ action: z.literal("iniciar") }),
  z.object({ action: z.literal("aguardar"), message: z.string().trim().min(3, "Diga o que está aguardando.").max(300) }),
  z.object({ action: z.literal("resolver"), message: z.string().trim().min(3, "Diga o que foi feito.").max(1000) }),
  z.object({ action: z.literal("reabrir"), message: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("cancelar"), message: z.string().trim().min(3, "Diga o motivo.").max(300) }),
  z.object({ action: z.literal("comentar"), message: z.string().trim().min(1, "Escreva o comentário.").max(1000) }),
  z.object({ action: z.literal("foraDeVenda"), value: z.boolean() }),
  z.object({ action: z.literal("prioridade"), value: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]) }),
]);

export type TicketActionInput = z.infer<typeof ticketActionSchema>;
