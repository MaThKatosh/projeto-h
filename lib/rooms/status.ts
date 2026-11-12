// ================================================================
// SITUAÇÃO VISUAL DO QUARTO
// ================================================================
//
// Junta as três situações do quarto (ocupação, limpeza, manutenção) numa
// cor principal + selos. Sem dependências do servidor: o mapa usa direto.
//
// Ordem de prioridade da cor principal:
//   bloqueado > em manutenção > ocupado > em arrumação > sujo > livre e limpo
// "Com problema" não muda a cor: vira um selo de alerta no cartão.

export type Occupancy = "LIVRE" | "OCUPADO";
export type Housekeeping = "LIMPO" | "SUJO" | "EM_ARRUMACAO";
export type Maintenance = "OK" | "COM_PROBLEMA" | "EM_MANUTENCAO" | "BLOQUEADO";

export type RoomState = {
  occupancy: Occupancy;
  housekeeping: Housekeeping;
  maintenance: Maintenance;
};

export type DisplayStatus =
  | "BLOQUEADO"
  | "EM_MANUTENCAO"
  | "OCUPADO"
  | "EM_ARRUMACAO"
  | "SUJO"
  | "LIVRE";

export const DISPLAY_ORDER: DisplayStatus[] = [
  "LIVRE",
  "OCUPADO",
  "SUJO",
  "EM_ARRUMACAO",
  "EM_MANUTENCAO",
  "BLOQUEADO",
];

// Classes do Tailwind escritas por extenso para o compilador encontrá-las.
export const DISPLAY: Record<
  DisplayStatus,
  { label: string; icon: string; card: string; dot: string }
> = {
  LIVRE: {
    label: "Livre e limpo",
    icon: "✓",
    card: "bg-emerald-500 text-white border-emerald-600",
    dot: "bg-emerald-500",
  },
  OCUPADO: {
    label: "Ocupado",
    icon: "●",
    card: "bg-blue-600 text-white border-blue-700",
    dot: "bg-blue-600",
  },
  SUJO: {
    label: "Sujo",
    icon: "✦",
    card: "bg-amber-300 text-amber-950 border-amber-500",
    dot: "bg-amber-300",
  },
  EM_ARRUMACAO: {
    label: "Em arrumação",
    icon: "⟳",
    card: "bg-orange-500 text-white border-orange-600",
    dot: "bg-orange-500",
  },
  EM_MANUTENCAO: {
    label: "Em manutenção",
    icon: "🔧",
    card: "bg-red-600 text-white border-red-700",
    dot: "bg-red-600",
  },
  BLOQUEADO: {
    label: "Bloqueado",
    icon: "⛔",
    card: "bg-zinc-700 text-white border-zinc-800",
    dot: "bg-zinc-700",
  },
};

export function displayStatus(room: RoomState): DisplayStatus {
  if (room.maintenance === "BLOQUEADO") return "BLOQUEADO";
  if (room.maintenance === "EM_MANUTENCAO") return "EM_MANUTENCAO";
  if (room.occupancy === "OCUPADO") return "OCUPADO";
  if (room.housekeeping === "EM_ARRUMACAO") return "EM_ARRUMACAO";
  if (room.housekeeping === "SUJO") return "SUJO";
  return "LIVRE";
}

// Selos extras: o que a cor principal esconde.
export function badges(room: RoomState): string[] {
  const list: string[] = [];
  const main = displayStatus(room);
  if (room.maintenance === "COM_PROBLEMA") list.push("⚠ Problema");
  if (main === "OCUPADO" || main === "BLOQUEADO" || main === "EM_MANUTENCAO") {
    if (room.housekeeping === "SUJO") list.push("Sujo");
    if (room.housekeeping === "EM_ARRUMACAO") list.push("Arrumando");
  }
  if (main !== "OCUPADO" && room.occupancy === "OCUPADO") list.push("Hóspede");
  return list;
}

// Quarto pode receber hóspede agora?
export function isSellable(room: RoomState): boolean {
  return displayStatus(room) === "LIVRE";
}

export const HOUSEKEEPING_LABEL: Record<Housekeeping, string> = {
  LIMPO: "Limpo",
  SUJO: "Sujo",
  EM_ARRUMACAO: "Em arrumação",
};

export const MAINTENANCE_LABEL: Record<Maintenance, string> = {
  OK: "Sem problemas",
  COM_PROBLEMA: "Com problema",
  EM_MANUTENCAO: "Em manutenção",
  BLOQUEADO: "Bloqueado",
};

export const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  LIVRE: "Livre",
  OCUPADO: "Ocupado",
};
