"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LiveDot, useLiveRefresh } from "@/components/live-refresh";
import { useNow } from "@/components/use-now";
import { clock } from "@/components/time";
import { itemStatusAction } from "../restaurante/actions";

type KItem = {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  status: "PENDENTE" | "PRONTO" | "ENTREGUE" | "CANCELADO";
  createdAt: string;
  readyAt: string | null;
  comandaId: string;
  comandaNumber: number;
  place: string;
};

export function KitchenBoard({ items, serverNow }: { items: KItem[]; serverNow: number }) {
  const router = useRouter();
  const connected = useLiveRefresh(["restaurant.changed"]);
  // O relógio começa no maior entre a hora do servidor e a do navegador.
  const now = Math.max(useNow(serverNow, 15_000), serverNow);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const todo = items.filter((i) => i.status === "PENDENTE");
  const ready = items.filter((i) => i.status === "PRONTO");

  // Agrupa os pedidos por comanda (uma "ficha" por mesa).
  const tickets = [...new Map(todo.map((i) => [i.comandaId, i])).values()].map((first) => ({
    ...first,
    lines: todo.filter((i) => i.comandaId === first.comandaId),
  }));

  const mark = (id: string, status: "PRONTO" | "ENTREGUE") =>
    start(async () => {
      setError(null);
      const r = await itemStatusAction(id, status);
      if (!r.ok) setError(r.error ?? "Não foi possível.");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">👨‍🍳 Cozinha</h1>
          <LiveDot connected={connected} />
        </div>
        <div className="flex gap-2 text-sm">
          <span className="card px-4 py-2"><b className="text-lg">{todo.length}</b> para preparar</span>
          <span className="card px-4 py-2"><b className="text-lg">{ready.length}</b> prontos aguardando o garçom</span>
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tickets.map((t) => {
          const minutes = Math.max(0, Math.floor((now - Date.parse(t.lines[0].createdAt)) / 60000));
          const tone = minutes >= 20 ? "border-red-500 bg-red-50" : minutes >= 10 ? "border-amber-400 bg-amber-50" : "border-zinc-200 bg-white";
          return (
            <section key={t.comandaId} className={`rounded-2xl border-2 p-4 shadow-sm ${tone}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-2xl font-black">{t.place}</span>
                <span className={`text-sm font-bold ${minutes >= 20 ? "text-red-700" : ""}`}>{minutes} min</span>
              </div>
              <div className="mb-3 text-xs text-zinc-500">comanda nº {t.comandaNumber} · pedido às {clock(t.lines[0].createdAt)}</div>
              <ul className="space-y-2">
                {t.lines.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 shadow-sm">
                    <div>
                      <div className="text-lg font-bold">{i.quantity}× {i.name}</div>
                      {i.notes && <div className="text-sm font-semibold text-red-700">⚠ {i.notes}</div>}
                    </div>
                    <button className="btn bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700" disabled={pending} onClick={() => mark(i.id, "PRONTO")}>
                      Pronto
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {tickets.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-8 text-center text-zinc-400 sm:col-span-2 xl:col-span-3">
            Nenhum pedido para preparar. 🎉
          </p>
        )}
      </div>

      {ready.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Prontos aguardando o garçom</h2>
          <div className="flex flex-wrap gap-2">
            {ready.map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-sm">
                <b>{i.place}</b> {i.quantity}× {i.name}
                <button className="text-xs text-emerald-900 underline" disabled={pending} onClick={() => mark(i.id, "ENTREGUE")}>entregue</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
