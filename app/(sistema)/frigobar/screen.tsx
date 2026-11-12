"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LiveDot, useLiveRefresh } from "@/components/live-refresh";
import { clock } from "@/components/time";
import { formatBRL } from "@/lib/money";
import { minibarAction } from "../restaurante/actions";

type Guest = { reservationId: string; number: number; name: string; room: string };
type Item = { id: string; name: string; group: string; priceCents: number };
type Consumed = { id: string; item: string; quantity: number; amountCents: number; room: string; by: string; createdAt: string };

export function MinibarScreen({ guests, menu, today, initialReservation }: { guests: Guest[]; menu: Item[]; today: Consumed[]; initialReservation: string }) {
  const router = useRouter();
  const connected = useLiveRefresh(["reservations.changed", "restaurant.changed"]);
  const [reservation, setReservation] = useState(initialReservation);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  const lines = menu.filter((m) => (qty[m.id] ?? 0) > 0);
  const total = lines.reduce((s, m) => s + m.priceCents * qty[m.id], 0);
  const guest = guests.find((g) => g.reservationId === reservation);
  const bump = (id: string, d: number) => setQty((p) => ({ ...p, [id]: Math.max(0, Math.min(50, (p[id] ?? 0) + d)) }));

  // Reposição: soma por item.
  const restock = Object.entries(
    today.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.item]: (acc[c.item] ?? 0) + c.quantity }), {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">🧃 Frigobar</h1>
        <LiveDot connected={connected} />
      </div>

      <section className="card space-y-4 p-4">
        <label className="block max-w-md">
          <span className="text-xs text-zinc-500">Quarto conferido</span>
          <select className="field text-lg" value={reservation} onChange={(e) => { setReservation(e.target.value); setMsg({}); }}>
            <option value="">Escolha o quarto</option>
            {guests.map((g) => (
              <option key={g.reservationId} value={g.reservationId}>Quarto {g.room} — {g.name}</option>
            ))}
          </select>
        </label>

        <div className={`grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2 ${reservation ? "" : "pointer-events-none opacity-40"}`}>
          {menu.map((m) => {
            const n = qty[m.id] ?? 0;
            return (
              <div key={m.id} className={`rounded-xl border-2 p-3 ${n ? "border-blue-500 bg-blue-50" : "border-zinc-200 bg-white"}`}>
                <div className="text-sm font-semibold">{m.name}</div>
                <div className="text-xs text-zinc-500">{formatBRL(m.priceCents)}</div>
                <div className="mt-2 flex items-center justify-between">
                  <button className="h-9 w-9 rounded-lg bg-zinc-100 text-xl font-bold" onClick={() => bump(m.id, -1)} aria-label={`Menos ${m.name}`}>−</button>
                  <span className="text-xl font-black">{n}</span>
                  <button className="h-9 w-9 rounded-lg bg-blue-600 text-xl font-bold text-white" onClick={() => bump(m.id, 1)} aria-label={`Mais ${m.name}`}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        {msg.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ {msg.ok}</p>}
        {msg.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}

        <button
          className="btn-primary w-full py-4 text-base sm:w-auto sm:px-8"
          disabled={pending || !reservation || lines.length === 0}
          onClick={() =>
            start(async () => {
              const r = await minibarAction(reservation, lines.map((m) => ({ menuItemId: m.id, quantity: qty[m.id] })));
              if (r.ok) {
                setMsg({ ok: `Lançado na conta do quarto ${guest?.room}: ${formatBRL(total)}.` });
                setQty({});
                router.refresh();
              } else setMsg({ error: r.error });
            })
          }
        >
          {lines.length ? `Lançar ${lines.reduce((s, m) => s + qty[m.id], 0)} item(ns) · ${formatBRL(total)}` : "Marque os itens consumidos"}
        </button>
        <p className="text-xs text-zinc-500">Lançou errado? O gerente estorna na conta do quarto (Reservas → reserva → Conta).</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Para repor hoje</h2>
          {restock.length === 0 ? (
            <p className="text-sm text-zinc-400">Nada consumido hoje.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {restock.map(([item, n]) => (
                <li key={item} className="flex justify-between"><span>{item}</span><b>{n}</b></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Lançamentos de hoje</h2>
          <ul className="space-y-1 text-sm">
            {today.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span><b>{c.room}</b> · {c.quantity}× {c.item} <span className="text-xs text-zinc-500">({c.by}, {clock(c.createdAt)})</span></span>
                <span>{formatBRL(c.amountCents)}</span>
              </li>
            ))}
            {today.length === 0 && <li className="text-zinc-400">Nenhum.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
