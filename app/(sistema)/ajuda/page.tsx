import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { HELP, topicsFor } from "@/lib/help/content";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// Manual dos funcionários: mostra o que interessa ao cargo de quem está logado.
export default async function AjudaPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const tr = await getT();
  const { user } = await verifySession();
  const { ver } = await searchParams;
  const all = ver === "tudo";
  const topics = all ? HELP : topicsFor(user.role);
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{tr("❓ Ajuda")}</h1>
        <p className="text-sm text-zinc-500">
          {all ? tr("Todos os tópicos do manual.") : tr("O passo a passo do que o seu cargo usa.")}{" "}
          <Link href={all ? "/ajuda" : "/ajuda?ver=tudo"} className="text-blue-700 underline">{all ? tr("só o meu cargo") : tr("ver o manual inteiro")}</Link>
        </p>
      </div>
      <nav className="flex flex-wrap gap-1.5">
        {topics.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="rounded-full bg-white px-3 py-1 text-sm shadow-sm hover:bg-zinc-100">{t.icon} {tr(t.title)}</a>
        ))}
      </nav>
      {topics.map((t) => (
        <section key={t.id} id={t.id} className="card scroll-mt-4 p-5">
          <h2 className="mb-2 text-lg font-semibold">{t.icon} {tr(t.title)}</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {t.steps.map((s, i) => <li key={i}>{tr(s)}</li>)}
          </ol>
          {t.tip && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">💡 {tr(t.tip)}</p>}
        </section>
      ))}
    </div>
  );
}
