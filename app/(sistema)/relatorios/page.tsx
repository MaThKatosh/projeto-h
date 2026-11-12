import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { redirect } from "next/navigation";
import { REPORTS } from "@/lib/reports/catalog";

import { getT } from "@/lib/i18n/server";
export default async function RelatoriosPage() {
  const tr = await getT();
  const { user } = await verifySession();
  const mine = REPORTS.filter((r) => r.roles.includes(user.role));
  if (mine.length === 0) redirect("/mapa?semPermissao=1");
  const groups = [...new Set(mine.map((r) => r.group))];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tr("Relatórios")}</h1>
        <p className="text-sm text-zinc-500">{tr("Escolha um relatório. Todos podem ser filtrados por data, impressos e baixados para o Excel.")}</p>
      </div>
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">{tr(g)}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine
              .filter((r) => r.group === g)
              .map((r) => (
                <Link key={r.slug} href={`/relatorios/${r.slug}`} className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="font-semibold">{tr(r.title)}</div>
                  <div className="mt-1 text-sm text-zinc-600">{tr(r.description)}</div>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
