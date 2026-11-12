import { verifySession } from "@/lib/auth/dal";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { logoutAction } from "@/app/entrar/actions";
import { Sidebar, type NavItem } from "./sidebar";

// Módulos do sistema. Os que ainda não existem aparecem apagados com a
// fase em que chegam: o funcionário já vê o "mapa" do sistema inteiro.
function navFor(role: Parameters<typeof can>[0]): NavItem[] {
  return [
    { href: "/mapa", label: "Mapa de quartos", icon: "▦" },
    ...(can(role, "reservations.view")
      ? [
          { href: "/recepcao", label: "Recepção", icon: "🛎" },
          { href: "/reservas", label: "Reservas", icon: "📅" },
          { href: "/garagem", label: "Garagem", icon: "🚗" },
        ]
      : []),
    ...(can(role, "housekeeping.view") ? [{ href: "/governanca", label: "Governança", icon: "🧹" }] : []),
    ...(can(role, "maintenance.view") ? [{ href: "/manutencao", label: "Manutenção", icon: "🔧" }] : []),
    ...(can(role, "finance.view") ? [{ href: "/financeiro", label: "Financeiro", icon: "💳" }] : []),
    ...(can(role, "restaurant.use") ? [{ href: "/restaurante", label: "Restaurante", icon: "🍽" }] : []),
    ...(can(role, "kitchen.view") ? [{ href: "/cozinha", label: "Cozinha", icon: "👨‍🍳" }] : []),
    ...(can(role, "minibar.post") ? [{ href: "/frigobar", label: "Frigobar", icon: "🧃" }] : []),
    ...(can(role, "audit.run") ? [{ href: "/auditoria", label: "Auditoria noturna", icon: "🌙" }] : []),
    { href: "/relatorios", label: "Relatórios", icon: "📊" },
    ...(can(role, "rooms.manage") ? [{ href: "/quartos", label: "Cadastro de quartos", icon: "🏨", group: "Administração" }] : []),
    ...(can(role, "menu.manage") ? [{ href: "/cardapio", label: "Cardápio e mesas", icon: "📋", group: "Administração" }] : []),
    ...(can(role, "rates.manage") ? [{ href: "/tarifas", label: "Tarifas", icon: "💲", group: "Administração" }] : []),
    ...(can(role, "users.manage") ? [{ href: "/usuarios", label: "Usuários", icon: "👥", group: "Administração" }] : []),
  ];
}

export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const { user } = await verifySession();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        items={navFor(user.role)}
        userName={user.fullName}
        roleLabel={ROLE_LABEL[user.role]}
        logout={logoutAction}
      />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
