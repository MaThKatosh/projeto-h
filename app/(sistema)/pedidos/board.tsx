"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n";
import { LiveDot } from "@/components/live-refresh";
import { useHotelEvents } from "@/components/use-hotel-events";
import { since } from "@/components/time";
import { REQUEST_LABEL, STATUS_LABEL } from "@/lib/requests/rules";
import type { RequestView } from "@/lib/requests/service";
import { handleRequestAction } from "./actions";

export function RequestBoard({ list }: { list: RequestView[] }) {
  const tr = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<string | null>(null);
  const connected = useHotelEvents({
    "requests.changed": (data) => {
      const msg = (data as { message?: string })?.message;
      if (msg) setFlash(msg);
      router.refresh();
    },
  });
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const act = (id: string, action: "atender" | "concluir") =>
    start(async () => {
      const r = await handleRequestAction(id, action);
      setError(r.ok ? null : (r.error ?? null));
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <LiveDot connected={connected} />
        {flash && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">{tr("Novo pedido:")} {tr(flash)}</span>}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{tr(error)}</p>}
      {list.length === 0 && <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400">{tr("Nenhum pedido em aberto. 🎉")}</p>}
      {list.map((r) => {
        const label = REQUEST_LABEL[r.type];
        return (
          <div key={r.id} className={`card flex items-center gap-3 p-3 ${r.status === "ABERTO" ? "border-l-4 border-l-amber-500" : r.status === "EM_ANDAMENTO" ? "border-l-4 border-l-sky-500" : "opacity-70"}`}>
            <div className="w-14 text-center">
              <div className="text-[10px] text-zinc-500">{tr("Quarto")}</div>
              <div className="text-xl leading-none font-black">{r.roomNumber}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{label.icon} {tr(label.label)}</div>
              {r.message && <div className="text-sm text-zinc-700">{r.message}</div>}
              <div className="text-xs text-zinc-500">
                {tr(STATUS_LABEL[r.status])} · {since(r.createdAt, now, tr)}
                {r.handledByName && ` · ${r.handledByName}`}
                {r.ticketNumber && (
                  <>
                    {" · "}
                    <Link href="/manutencao" className="text-blue-700 underline">{tr("ocorrência nº {0}", [r.ticketNumber])}</Link>
                  </>
                )}
              </div>
            </div>
            {r.status === "ABERTO" && (
              <button className="btn-secondary" disabled={pending} onClick={() => act(r.id, "atender")}>{tr("Vou atender")}</button>
            )}
            {r.status !== "CONCLUIDO" && (
              <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" disabled={pending} onClick={() => act(r.id, "concluir")}>{tr("Concluído")}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
