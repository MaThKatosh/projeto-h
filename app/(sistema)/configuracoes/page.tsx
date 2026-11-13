import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { getHotelSettings, getParkingDailyCents, listCardBrands } from "@/lib/settings";
import { getServiceFeeBp } from "@/lib/restaurant/service";
import { formatBRL } from "@/lib/money";
import { headers } from "next/headers";
import { tokenInfo } from "@/lib/integrations/service";
import { BrandRow, HotelForm } from "./forms";
import { IntegrationSection } from "./integration";

import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const tr = await getT();
  await requirePermission("settings.manage");
  const db = getDb();
  const [settings, brands, rooms, types, plans, menu, tables, users, parking, fee, lastRun, token, h] = await Promise.all([
    getHotelSettings(db),
    listCardBrands(db),
    db.room.count({ where: { active: true } }),
    db.roomType.count(),
    db.ratePlan.count({ where: { active: true } }),
    db.menuItem.groupBy({ by: ["outlet"], where: { active: true }, _count: true }),
    db.diningTable.count({ where: { active: true } }),
    db.user.count({ where: { active: true } }),
    getParkingDailyCents(db),
    getServiceFeeBp(db),
    db.auditRun.findFirst({ where: { undoneAt: null }, orderBy: { businessDate: "desc" }, select: { businessDate: true } }),
    tokenInfo(db),
    headers(),
  ]);
  // Endereço como o navegador vê o sistema (rede do hotel ou domínio na nuvem).
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const count = (o: string) => menu.find((m) => m.outlet === o)?._count ?? 0;

  const shortcuts = [
    { href: "/quartos", icon: "🏨", title: tr("Quartos e tipos"), text: tr("{0} quartos ativos em {1} tipos. Criar vários de uma vez, desativar, mudar tipo.", [rooms, types]) },
    { href: "/tarifas", icon: "💲", title: tr("Tarifas, ISS e estacionamento"), text: tr("{0} tarifa(s) ativa(s). Estacionamento: {1}.", [plans, parking ? tr("{0} por noite", [formatBRL(parking)]) : tr("grátis")]) },
    { href: "/cardapio", icon: "📋", title: tr("Cardápios, mesas e taxa de serviço"), text: tr("Restaurante: {0} itens · Frigobar: {1} itens · {2} mesas · serviço {3}%.", [count("RESTAURANTE"), count("FRIGOBAR"), tables, fee / 100]) },
    { href: "/usuarios", icon: "👥", title: tr("Usuários e cargos"), text: tr("{0} usuários ativos. Criar, trocar cargo, redefinir senha, desativar.", [users]) },
    { href: "/configuracoes/privacidade", icon: "🔒", title: tr("Privacidade dos hóspedes (LGPD)"), text: tr("Exportar os dados de um hóspede, anonimizar a pedido ou cadastros antigos.") },
    { href: "/configuracoes/importar-hospedes", icon: "📥", title: tr("Importar hóspedes"), text: tr("Trazer o cadastro de hóspedes do sistema antigo (planilha).") },
    { href: "/auditoria", icon: "🌙", title: tr("Auditoria noturna"), text: lastRun ? tr("Última: {0}. Dá para desfazer a última por lá.", [lastRun.businessDate.toISOString().slice(0, 10).split("-").reverse().join("/")]) : tr("Nenhuma ainda.") },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tr("Configurações")}</h1>
        <p className="text-sm text-zinc-500">{tr("Tudo o que dá para ajustar no sistema, num lugar só.")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-2xl">{s.icon}</div>
            <div className="font-semibold">{s.title}</div>
            <div className="mt-1 text-sm text-zinc-600">{s.text}</div>
          </Link>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-2 font-semibold">{tr("↶ Corrigir erros (gerente e administrador)")}</h2>
        <ul className="space-y-2 text-sm">
          <li><b>{tr("Rodei a auditoria por engano / duas vezes")}</b>{" "}{tr("→ Auditoria noturna → “Desfazer a auditoria”. Estorna as diárias dela e volta a data.")}</li>
          <li><b>{tr("Check-in no hóspede ou quarto errado")}</b>{" "}{tr("→ abra a reserva → “Desfazer check-in”.")}</li>
          <li><b>{tr("Check-out por engano")}</b>{" "}{tr("→ abra a reserva → “Desfazer check-out” (o hóspede volta para o mesmo quarto).")}</li>
          <li><b>{tr("Cancelei ou marquei “não compareceu” sem querer")}</b>{" "}{tr("→ abra a reserva → “Reativar reserva”.")}</li>
          <li><b>{tr("Lançamento errado na conta")}</b>{" "}{tr("(diária, consumo, pagamento) → na conta do quarto, “estornar”.")}</li>
          <li><b>{tr("Item errado no restaurante")}</b>{" "}{tr("→ na comanda, “cancelar” o item.")}</li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">{tr("Tudo pede um motivo e fica registrado (histórico da reserva e relatório “Registro de ações”).")}</p>
      </section>

      <HotelForm settings={settings} />

      <section className="card space-y-2 p-5">
        <h2 className="font-semibold">{tr("💳 Bandeiras de cartão")}</h2>
        <p className="text-sm text-zinc-500">{tr("Aparecem para escolha nos pagamentos com cartão (conta do quarto e restaurante) e no borderô. Desative as que a sua maquininha não aceita; a ordem define a posição na tela.")}</p>
        {brands.map((b) => (
          <BrandRow key={b.id} brand={b} />
        ))}
        <BrandRow />
      </section>

      <IntegrationSection info={token} origin={origin} />
    </div>
  );
}
