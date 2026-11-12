// Pedidos dos hóspedes: listas usadas na página do QR e na tela da equipe
// (sem dependências do servidor).

export const REQUEST_TYPES = ["LIMPEZA", "TOALHAS", "AMENIDADES", "PROBLEMA", "OUTRO"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_LABEL: Record<RequestType, { icon: string; label: string }> = {
  LIMPEZA: { icon: "🧹", label: "Limpeza do quarto" },
  TOALHAS: { icon: "🧺", label: "Toalhas / roupa de cama" },
  AMENIDADES: { icon: "🧴", label: "Itens de higiene" },
  PROBLEMA: { icon: "🛠", label: "Relatar um problema" },
  OUTRO: { icon: "💬", label: "Outro pedido" },
};

// Problemas mais comuns (viram o título da ocorrência).
export const PROBLEM_KINDS = ["Ar-condicionado", "Chuveiro / água quente", "Vazamento", "TV", "Wi-Fi", "Luz / tomada", "Fechadura / porta", "Frigobar", "Barulho", "Outro"] as const;

export const STATUS_LABEL = { ABERTO: "Pedido recebido", EM_ANDAMENTO: "Em atendimento", CONCLUIDO: "Concluído" } as const;
