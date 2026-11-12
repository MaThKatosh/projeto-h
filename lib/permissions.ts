// ================================================================
// CARGOS E PERMISSÕES
// ================================================================
//
// Sem dependências do servidor: o cliente também usa para decidir que
// botões mostrar. A decisão que vale, porém, é sempre a do servidor.

export const ROLES = [
  "ADMIN",
  "GERENTE",
  "RECEPCAO",
  "GOVERNANCA",
  "MANUTENCAO",
  "RESTAURANTE",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  RECEPCAO: "Recepção",
  GOVERNANCA: "Governança",
  MANUTENCAO: "Manutenção",
  RESTAURANTE: "Restaurante",
};

// Hierarquia: quanto maior, mais alto. Quem gerencia usuários só mexe
// em cargos ABAIXO do seu.
export const ROLE_LEVEL: Record<Role, number> = {
  ADMIN: 100,
  GERENTE: 80,
  RECEPCAO: 50,
  GOVERNANCA: 40,
  MANUTENCAO: 40,
  RESTAURANTE: 40,
};

export type Permission =
  | "rooms.view"
  | "rooms.manage" // cadastrar quartos e tipos
  | "rooms.housekeeping" // limpo / sujo / em arrumação
  | "rooms.reportProblem" // abrir ocorrência de manutenção
  | "rooms.maintenance" // trabalhar nas ocorrências, bloquear/desbloquear quarto
  | "housekeeping.view" // painel da governança
  | "housekeeping.assign" // escolher quem arruma cada quarto, prioridade
  | "maintenance.view" // painel da manutenção
  | "maintenance.cancel" // cancelar ocorrência
  | "reservations.view" // ver reservas, recepção e garagem
  | "reservations.manage" // criar/alterar reservas, check-in/out, troca de quarto
  | "rates.manage" // tarifas
  | "finance.view" // ver contas e o financeiro (borderô)
  | "finance.post" // lançar cobranças e receber pagamentos
  | "finance.reverse" // estornar lançamentos
  | "restaurant.use" // abrir comanda, pedir, receber, lançar no quarto
  | "restaurant.cancel" // cancelar item já preparado ou comanda com itens
  | "kitchen.view" // tela da cozinha
  | "menu.manage" // cardápio, mesas, taxa de serviço
  | "minibar.post" // lançar consumo do frigobar
  | "audit.run" // rodar a auditoria noturna
  | "reports.view" // relatórios (cada relatório pode restringir mais)
  | "settings.manage" // configurações do hotel, bandeiras, formas de pagamento
  | "undo" // desfazer auditoria, check-in, check-out; reativar reserva
  | "users.manage";

const PERMISSIONS: Record<Permission, readonly Role[]> = {
  "rooms.view": ROLES,
  "rooms.manage": ["ADMIN", "GERENTE"],
  "rooms.housekeeping": ["ADMIN", "GERENTE", "RECEPCAO", "GOVERNANCA"],
  "rooms.reportProblem": ["ADMIN", "GERENTE", "RECEPCAO", "GOVERNANCA", "MANUTENCAO"],
  "rooms.maintenance": ["ADMIN", "GERENTE", "MANUTENCAO"],
  "housekeeping.view": ["ADMIN", "GERENTE", "RECEPCAO", "GOVERNANCA"],
  "housekeeping.assign": ["ADMIN", "GERENTE", "GOVERNANCA"],
  "maintenance.view": ["ADMIN", "GERENTE", "RECEPCAO", "GOVERNANCA", "MANUTENCAO"],
  "maintenance.cancel": ["ADMIN", "GERENTE"],
  "reservations.view": ["ADMIN", "GERENTE", "RECEPCAO"],
  "reservations.manage": ["ADMIN", "GERENTE", "RECEPCAO"],
  "rates.manage": ["ADMIN", "GERENTE"],
  "finance.view": ["ADMIN", "GERENTE", "RECEPCAO"],
  "finance.post": ["ADMIN", "GERENTE", "RECEPCAO"],
  "finance.reverse": ["ADMIN", "GERENTE"],
  "restaurant.use": ["ADMIN", "GERENTE", "RECEPCAO", "RESTAURANTE"],
  "restaurant.cancel": ["ADMIN", "GERENTE"],
  "kitchen.view": ["ADMIN", "GERENTE", "RESTAURANTE"],
  "menu.manage": ["ADMIN", "GERENTE"],
  "minibar.post": ["ADMIN", "GERENTE", "RECEPCAO", "GOVERNANCA"],
  // O recepcionista da noite costuma fazer a auditoria.
  "audit.run": ["ADMIN", "GERENTE", "RECEPCAO"],
  "reports.view": ["ADMIN", "GERENTE", "RECEPCAO"],
  "settings.manage": ["ADMIN", "GERENTE"],
  "undo": ["ADMIN", "GERENTE"],
  "users.manage": ["ADMIN", "GERENTE"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}

export function canManageRole(actor: Role, target: Role): boolean {
  if (!can(actor, "users.manage")) return false;
  if (actor === "ADMIN") return true;
  return ROLE_LEVEL[target] < ROLE_LEVEL[actor];
}

export function manageableRoles(actor: Role): Role[] {
  return ROLES.filter((role) => canManageRole(actor, role));
}
