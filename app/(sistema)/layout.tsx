import { verifySession } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { getHotelSettings } from "@/lib/settings";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { logoutAction } from "@/app/entrar/actions";
import { Sidebar, type NavItem } from "./sidebar";
import { openRequestCount } from "@/lib/requests/service";
import { isDemo } from "@/lib/demo";
import { FeedbackButton } from "@/components/feedback-button";

import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";
// Módulos do sistema. Os que ainda não existem aparecem apagados com a
// fase em que chegam: o funcionário já vê o "mapa" do sistema inteiro.
function navFor(role: Parameters<typeof can>[0], tr: TFunction, requests: number): NavItem[] {
  return [
    { href: "/mapa", label: tr("Mapa de quartos"), icon: "▦" },
    ...(can(role, "requests.handle") ? [{ href: "/pedidos", label: tr("Pedidos dos hóspedes"), icon: "🔔", badge: requests }] : []),
    ...(can(role, "reservations.view")
      ? [
          { href: "/recepcao", label: tr("Recepção"), icon: "🛎" },
          { href: "/reservas", label: tr("Reservas"), icon: "📅" },
          { href: "/garagem", label: tr("Garagem"), icon: "🚗" },
        ]
      : []),
    ...(can(role, "housekeeping.view") ? [{ href: "/governanca", label: tr("Governança"), icon: "🧹" }] : []),
    ...(can(role, "maintenance.view") ? [{ href: "/manutencao", label: tr("Manutenção"), icon: "🔧" }] : []),
    ...(can(role, "finance.view") ? [{ href: "/financeiro", label: tr("Financeiro"), icon: "💳" }] : []),
    ...(can(role, "restaurant.use") ? [{ href: "/restaurante", label: tr("Restaurante"), icon: "🍽" }] : []),
    ...(can(role, "kitchen.view") ? [{ href: "/cozinha", label: tr("Cozinha"), icon: "👨‍🍳" }] : []),
    ...(can(role, "minibar.post") ? [{ href: "/frigobar", label: tr("Frigobar"), icon: "🧃" }] : []),
    ...(can(role, "revenue.manage") ? [{ href: "/revenue", label: tr("Revenue (preços)"), icon: "📈" }] : []),
    ...(can(role, "audit.run") ? [{ href: "/auditoria", label: tr("Auditoria noturna"), icon: "🌙" }] : []),
    { href: "/relatorios", label: tr("Relatórios"), icon: "📊" },
    { href: "/ajuda", label: tr("Ajuda"), icon: "❓" },
    ...(isDemo() && can(role, "settings.manage") ? [{ href: "/sugestoes", label: tr("Sugestões dos testadores"), icon: "💬", group: "Administração" }] : []),
    ...(can(role, "settings.manage") ? [{ href: "/configuracoes", label: tr("Configurações"), icon: "⚙️", group: "Administração" }] : []),
    ...(can(role, "rooms.manage") ? [{ href: "/quartos", label: tr("Cadastro de quartos"), icon: "🏨", group: "Administração" }] : []),
    ...(can(role, "menu.manage") ? [{ href: "/cardapio", label: tr("Cardápio e mesas"), icon: "📋", group: "Administração" }] : []),
    ...(can(role, "rates.manage") ? [{ href: "/tarifas", label: tr("Tarifas"), icon: "💲", group: "Administração" }] : []),
    ...(can(role, "users.manage") ? [{ href: "/usuarios", label: tr("Usuários"), icon: "👥", group: "Administração" }] : []),
  ];
}

export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const { user } = await verifySession();
  const tr = await getT();
  const db = getDb();
  const [{ hotelName }, requests] = await Promise.all([getHotelSettings(db), can(user.role, "requests.handle") ? openRequestCount(db) : 0]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        hotelName={hotelName}
        items={navFor(user.role, tr, requests)}
        userName={user.fullName}
        roleLabel={tr(ROLE_LABEL[user.role])}
        logout={logoutAction}
      />
      <main className="min-w-0 flex-1 p-4 md:p-6">
        {isDemo() && (
          <div className="no-print mb-3 rounded-lg bg-amber-100 px-3 py-1.5 text-center text-xs font-semibold text-amber-900">
            {tr("🧪 Versão de teste — dados fictícios. Use o botão “💬 Sugestão / erro” para contar o que achou.")}
          </div>
        )}
        {children}
      </main>
      {isDemo() && <FeedbackButton />}
    </div>
  );
}
