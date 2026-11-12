import Link from "next/link";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { getHotelSettings, getParkingDailyCents, listCardBrands } from "@/lib/settings";
import { getServiceFeeBp } from "@/lib/restaurant/service";
import { formatBRL } from "@/lib/money";
import { BrandRow, HotelForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await requirePermission("settings.manage");
  const db = getDb();
  const [settings, brands, rooms, types, plans, menu, tables, users, parking, fee, lastRun] = await Promise.all([
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
  ]);
  const count = (o: string) => menu.find((m) => m.outlet === o)?._count ?? 0;

  const shortcuts = [
    { href: "/quartos", icon: "🏨", title: "Quartos e tipos", text: `${rooms} quartos ativos em ${types} tipos. Criar vários de uma vez, desativar, mudar tipo.` },
    { href: "/tarifas", icon: "💲", title: "Tarifas, ISS e estacionamento", text: `${plans} tarifa(s) ativa(s). Estacionamento: ${parking ? `${formatBRL(parking)} por noite` : "grátis"}.` },
    { href: "/cardapio", icon: "📋", title: "Cardápios, mesas e taxa de serviço", text: `Restaurante: ${count("RESTAURANTE")} itens · Frigobar: ${count("FRIGOBAR")} itens · ${tables} mesas · serviço ${fee / 100}%.` },
    { href: "/usuarios", icon: "👥", title: "Usuários e cargos", text: `${users} usuários ativos. Criar, trocar cargo, redefinir senha, desativar.` },
    { href: "/auditoria", icon: "🌙", title: "Auditoria noturna", text: lastRun ? `Última: ${lastRun.businessDate.toISOString().slice(0, 10).split("-").reverse().join("/")}. Dá para desfazer a última por lá.` : "Nenhuma ainda." },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-zinc-500">Tudo o que dá para ajustar no sistema, num lugar só.</p>
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
        <h2 className="mb-2 font-semibold">↶ Corrigir erros (gerente e administrador)</h2>
        <ul className="space-y-2 text-sm">
          <li><b>Rodei a auditoria por engano / duas vezes</b> → Auditoria noturna → “Desfazer a auditoria”. Estorna as diárias dela e volta a data.</li>
          <li><b>Check-in no hóspede ou quarto errado</b> → abra a reserva → “Desfazer check-in”.</li>
          <li><b>Check-out por engano</b> → abra a reserva → “Desfazer check-out” (o hóspede volta para o mesmo quarto).</li>
          <li><b>Cancelei ou marquei “não compareceu” sem querer</b> → abra a reserva → “Reativar reserva”.</li>
          <li><b>Lançamento errado na conta</b> (diária, consumo, pagamento) → na conta do quarto, “estornar”.</li>
          <li><b>Item errado no restaurante</b> → na comanda, “cancelar” o item.</li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">Tudo pede um motivo e fica registrado (histórico da reserva e relatório “Registro de ações”).</p>
      </section>

      <HotelForm settings={settings} />

      <section className="card space-y-2 p-5">
        <h2 className="font-semibold">💳 Bandeiras de cartão</h2>
        <p className="text-sm text-zinc-500">
          Aparecem para escolha nos pagamentos com cartão (conta do quarto e restaurante) e no borderô. Desative as que a sua
          maquininha não aceita; a ordem define a posição na tela.
        </p>
        {brands.map((b) => (
          <BrandRow key={b.id} brand={b} />
        ))}
        <BrandRow />
      </section>
    </div>
  );
}
