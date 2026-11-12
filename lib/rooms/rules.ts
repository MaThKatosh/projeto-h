import { z } from "zod";
import { can, type Role } from "@/lib/permissions";
import type { Maintenance, Occupancy } from "@/lib/rooms/status";

// ================================================================
// REGRAS DE MUDANÇA DE SITUAÇÃO DO QUARTO (pelo mapa)
// ================================================================
//
// Sem dependências do servidor: o mapa usa para habilitar os botões, e o
// servidor usa a MESMA função para decidir de verdade.
//
// Desde a Fase 2, "com problema" e "em manutenção" NÃO são escolhidos à
// mão: saem das ocorrências abertas (lib/maintenance/rules.ts). Pelo
// mapa só se BLOQUEIA (decisão da chefia/manutenção, ex.: reforma) ou
// DESBLOQUEIA (value "OK": a situação volta a ser calculada).

export const statusChangeSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("housekeeping"), value: z.enum(["LIMPO", "SUJO", "EM_ARRUMACAO"]) }),
  z.object({ field: z.literal("maintenance"), value: z.enum(["BLOQUEADO", "OK"]) }),
  z.object({
    field: z.literal("note"),
    value: z.string().trim().max(120, "A observação pode ter no máximo 120 caracteres."),
  }),
]);

export type StatusChange = z.infer<typeof statusChangeSchema>;

type Current = { maintenance: Maintenance; occupancy?: Occupancy };

export function canChangeStatus(role: Role, current: Current, change: StatusChange): boolean {
  switch (change.field) {
    case "housekeeping":
      return can(role, "rooms.housekeeping");
    case "note":
      return can(role, "rooms.reportProblem") || can(role, "rooms.housekeeping");
    case "maintenance":
      return can(role, "rooms.maintenance");
  }
}

// Arrumar um quarto em manutenção não adianta: quando a manutenção
// terminar ele volta sujo de qualquer forma.
export function cleaningBlockedReason(maintenance: Maintenance): string | null {
  if (maintenance === "EM_MANUTENCAO") return "Quarto em manutenção: espere a manutenção liberar para arrumar.";
  if (maintenance === "BLOQUEADO") return "Quarto bloqueado: só arruma depois de desbloquear.";
  return null;
}

// Motivo para recusar uma mudança permitida ao cargo, ou null.
export function blockReason(current: Current, change: StatusChange): string | null {
  if (change.field !== "maintenance") return null;
  if (change.value === "BLOQUEADO") {
    if (current.maintenance === "BLOQUEADO") return "O quarto já está bloqueado.";
    if (current.occupancy === "OCUPADO") return "Quarto ocupado não pode ser bloqueado.";
  }
  if (change.value === "OK" && current.maintenance !== "BLOQUEADO") {
    return "Só dá para desbloquear um quarto bloqueado. Problemas se resolvem pelas ocorrências.";
  }
  return null;
}
