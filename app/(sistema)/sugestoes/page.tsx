import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { dateTime } from "@/components/time";
import { getT } from "@/lib/i18n/server";
import { DoneToggle } from "./toggle";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { ERRO: "🐞 Erro", SUGESTAO: "💡 Sugestão", ELOGIO: "👍 Gostei" };

// O que os testadores mandaram pelo botão "Sugestão / erro".
export default async function SugestoesPage() {
  const tr = await getT();
  await requirePermission("settings.manage");
  const list = await getDb().feedback.findMany({
    orderBy: [{ done: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: { id: true, number: true, kind: true, message: true, page: true, device: true, done: true, createdAt: true, user: { select: { fullName: true, username: true } } },
  });
  const open = list.filter((f) => !f.done).length;
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{tr("Sugestões dos testadores")}</h1>
        <p className="text-sm text-zinc-500">{tr("{0} em aberto. Chegam pelo botão “💬 Sugestão / erro” que aparece na versão de teste.", [open])}</p>
      </div>
      {list.length === 0 && <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400">{tr("Nada por enquanto.")}</p>}
      {list.map((f) => (
        <div key={f.id} className={`card p-3 ${f.done ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <b>{tr(KIND[f.kind] ?? f.kind)} · nº {f.number}</b>
            <span className="text-xs text-zinc-500">
              {f.user?.fullName ?? "—"} (@{f.user?.username}) · {dateTime(f.createdAt.toISOString())} · {f.page}
            </span>
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{f.message}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-zinc-400" title={f.device ?? ""}>{f.device}</span>
            <DoneToggle id={f.id} done={f.done} />
          </div>
        </div>
      ))}
    </div>
  );
}
