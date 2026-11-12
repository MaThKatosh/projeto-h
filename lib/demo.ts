import type { Role } from "@/lib/permissions";

// ================================================================
// VERSÃO DE TESTE (beta) — ligada com DEMO_MODE=1 no servidor do beta.
// Hotel fictício, contas de teste conhecidas e botão de sugestões.
// ================================================================

export function isDemo(): boolean {
  return process.env.DEMO_MODE === "1";
}

// Senha das contas de teste (pública de propósito: é só para o beta).
export const DEMO_PASSWORD = "teste123";

export const DEMO_ACCOUNTS: { username: string; fullName: string; role: Role; hint: string }[] = [
  { username: "gerente", fullName: "Gerente (teste)", role: "GERENTE", hint: "vê e mexe em quase tudo" },
  { username: "recepcao", fullName: "Recepção (teste)", role: "RECEPCAO", hint: "reservas, check-in/out, contas" },
  { username: "governanca", fullName: "Governança (teste)", role: "GOVERNANCA", hint: "arrumação dos quartos" },
  { username: "manutencao", fullName: "Manutenção (teste)", role: "MANUTENCAO", hint: "ocorrências" },
  { username: "restaurante", fullName: "Restaurante (teste)", role: "RESTAURANTE", hint: "salão, comandas, cozinha" },
];

export const isDemoAccount = (username: string) => isDemo() && DEMO_ACCOUNTS.some((a) => a.username === username);
