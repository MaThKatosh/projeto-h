"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LiveDot, useLiveRefresh } from "@/components/live-refresh";
import { clock } from "@/components/time";
import { centsToInput, formatBRL, parseBRL } from "@/lib/money";
import { METHOD, type Method } from "@/lib/folio/rules";
import { needsBrand, PaymentPicker, type PaymentOptions } from "@/components/payment-picker";
import { change, ITEM_STATUS } from "@/lib/restaurant/rules";
import type { ComandaView } from "@/lib/restaurant/service";
import {
  addItemsAction,
  cancelComandaAction,
  cancelItemAction,
  closePaidAction,
  closeToRoomAction,
  itemStatusAction,
  posPaymentAction,
  updateComandaAction,
  type ActionResult,
} from "../../actions";

type MenuItem = { id: string; name: string; group: string; priceCents: number; kitchen: boolean };
type Guest = { reservationId: string; number: number; name: string; room: string };
type CartLine = { menuItemId: string; name: string; priceCents: number; quantity: number; notes: string };

export function ComandaScreen({
  c,
  menu,
  guests,
  canCancel,
  paymentOptions,
}: {
  c: ComandaView;
  menu: MenuItem[];
  guests: Guest[];
  canCancel: boolean;
  paymentOptions: PaymentOptions;
}) {
  const router = useRouter();
  const connected = useLiveRefresh(["restaurant.changed"]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const open = c.status === "ABERTA";
  const place = c.tableName ? `Mesa ${c.tableName}` : c.guest?.room ? `Quarto ${c.guest.room} (serviço de quarto)` : c.customerName || "Balcão";

  const act = (fn: () => Promise<ActionResult>, ok: string, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        setNotice(ok);
        after?.();
        router.refresh();
      } else setError(r.error ?? "Não foi possível.");
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/restaurante" className="text-sm text-blue-700 underline">← Salão</Link>
          <h1 className="text-2xl font-bold">
            {place} <span className="text-base font-normal text-zinc-500">· comanda nº {c.number}</span>
          </h1>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <LiveDot connected={connected} />
            <span>aberta às {clock(c.openedAt)} por {c.openedByName ?? "—"} · {c.people} pessoa(s)</span>
          </div>
        </div>
        {!open && (
          <span className={`rounded-lg px-3 py-2 font-semibold ${c.status === "FECHADA" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
            {c.status === "FECHADA" ? (c.settlement === "QUARTO" ? `Lançada no quarto ${c.guest?.room ?? ""}` : "Paga no restaurante") : `Cancelada: ${c.cancelReason}`}
          </span>
        )}
      </div>

      {notice && !error && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ {notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className={`grid gap-4 ${open ? "lg:grid-cols-[1.3fr_1fr]" : ""}`}>
        {open && <MenuPicker menu={menu} pending={pending} onSend={(lines, done) => act(() => addItemsAction(c.id, lines), "Pedido enviado.", done)} />}

        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Itens da comanda</h2>
            <ul className="divide-y divide-zinc-100">
              {c.items.map((i) => (
                <li key={i.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${i.status === "CANCELADO" ? "text-zinc-400 line-through" : ""}`}>
                  <div className="min-w-0">
                    <div className="font-medium">{i.quantity}× {i.name}</div>
                    {i.notes && <div className="text-xs text-amber-700">📝 {i.notes}</div>}
                    {i.cancelReason && <div className="text-xs no-underline">motivo: {i.cancelReason}</div>}
                    <div className="text-xs text-zinc-500">{clock(i.createdAt)} · {i.createdByName ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold no-underline ${ITEM_STATUS[i.status].chip}`}>{ITEM_STATUS[i.status].label}</span>
                    <span className="w-20 text-right text-sm">{formatBRL(i.unitCents * i.quantity)}</span>
                    {open && i.status === "PRONTO" && (
                      <button className="btn bg-emerald-600 px-2 py-1 text-xs text-white" disabled={pending} onClick={() => act(() => itemStatusAction(i.id, "ENTREGUE"), "Item entregue.")}>Entregue</button>
                    )}
                    {open && i.status !== "CANCELADO" && (i.status === "PENDENTE" || canCancel) && (
                      <button
                        className="text-xs text-red-700 underline"
                        disabled={pending}
                        onClick={() => {
                          const reason = prompt(`Motivo do cancelamento de ${i.name}:`);
                          if (reason) act(() => cancelItemAction(i.id, reason), "Item cancelado.");
                        }}
                      >
                        cancelar
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {c.items.length === 0 && <li className="py-6 text-center text-sm text-zinc-400">Nenhum item ainda. Escolha no cardápio.</li>}
            </ul>

            <dl className="mt-3 space-y-1 border-t border-zinc-200 pt-3 text-sm">
              <Row k="Subtotal" v={formatBRL(c.totals.subtotal)} />
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-zinc-600">
                  {open ? (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={c.serviceFee} disabled={pending} onChange={(e) => act(() => updateComandaAction(c.id, { serviceFee: e.target.checked }), "Taxa de serviço atualizada.")} />
                      Serviço ({c.serviceFeeBp / 100}%)
                    </label>
                  ) : (
                    `Serviço (${c.serviceFee ? c.serviceFeeBp / 100 : 0}%)`
                  )}
                </dt>
                <dd>{formatBRL(c.totals.service)}</dd>
              </div>
              <div className="flex justify-between text-lg font-black">
                <dt>Total</dt>
                <dd>{formatBRL(c.totals.total)}</dd>
              </div>
              {c.totals.paid > 0 && <Row k="Já pago" v={formatBRL(c.totals.paid)} />}
              {open && c.totals.paid > 0 && <Row k="Falta" v={formatBRL(c.totals.remaining)} strong />}
            </dl>
            {c.payments.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                {c.payments.map((p) => (
                  <li key={p.id}>{METHOD[p.method].icon} {METHOD[p.method].label}{p.cardBrand ? ` ${p.cardBrand}` : ""} {formatBRL(p.amountCents)} às {clock(p.createdAt)}</li>
                ))}
              </ul>
            )}
          </section>

          {open && (
            <Settle c={c} guests={guests} pending={pending} canCancel={canCancel} paymentOptions={paymentOptions} act={act} onClosed={() => router.push("/restaurante")} />
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------

function MenuPicker({ menu, pending, onSend }: { menu: MenuItem[]; pending: boolean; onSend: (lines: object[], done: () => void) => void }) {
  const groups = useMemo(() => [...new Set(menu.map((m) => m.group))], [menu]);
  const [group, setGroup] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const shown = menu.filter((m) => (!group || m.group === group) && (!search || m.name.toLowerCase().includes(search.toLowerCase())));
  const cartTotal = cart.reduce((s, l) => s + l.priceCents * l.quantity, 0);

  const add = (m: MenuItem) =>
    setCart((prev) => {
      const found = prev.find((l) => l.menuItemId === m.id && !l.notes);
      if (found) return prev.map((l) => (l === found ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { menuItemId: m.id, name: m.name, priceCents: m.priceCents, quantity: 1, notes: "" }];
    });

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 font-semibold">Cardápio</h2>
        <button className={`rounded-full px-3 py-1 text-sm ${!group ? "bg-zinc-900 text-white" : "bg-zinc-100"}`} onClick={() => setGroup(null)}>Tudo</button>
        {groups.map((g) => (
          <button key={g} className={`rounded-full px-3 py-1 text-sm ${group === g ? "bg-zinc-900 text-white" : "bg-zinc-100"}`} onClick={() => setGroup(g)}>{g}</button>
        ))}
        <input className="field ml-auto max-w-44" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
        {shown.map((m) => (
          <button key={m.id} type="button" onClick={() => add(m)} className="flex min-h-20 flex-col rounded-xl border border-zinc-200 bg-white p-2.5 text-left hover:border-blue-500 hover:bg-blue-50 active:scale-95">
            <span className="text-sm leading-tight font-semibold">{m.name}</span>
            <span className="mt-auto text-sm text-zinc-600">{formatBRL(m.priceCents)}</span>
            {!m.kitchen && <span className="text-[10px] text-zinc-400">sai na hora</span>}
          </button>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-3">
          <h3 className="mb-2 text-sm font-semibold">Novo pedido</h3>
          <ul className="space-y-2">
            {cart.map((l, idx) => (
              <li key={idx} className="flex flex-wrap items-center gap-2 text-sm">
                <div className="flex items-center rounded-lg border border-zinc-300 bg-white">
                  <button className="px-2 py-1" onClick={() => setCart((p) => p.flatMap((x, i) => (i === idx ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x])))} aria-label="Menos">−</button>
                  <span className="w-6 text-center font-bold">{l.quantity}</span>
                  <button className="px-2 py-1" onClick={() => setCart((p) => p.map((x, i) => (i === idx ? { ...x, quantity: x.quantity + 1 } : x)))} aria-label="Mais">+</button>
                </div>
                <span className="flex-1 font-medium">{l.name}</span>
                <input
                  className="field w-40 py-1 text-xs"
                  placeholder="obs. (sem cebola...)"
                  value={l.notes}
                  maxLength={120}
                  onChange={(e) => setCart((p) => p.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))}
                />
                <span className="w-20 text-right">{formatBRL(l.priceCents * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between">
            <button className="text-sm text-zinc-600 underline" onClick={() => setCart([])}>limpar</button>
            <button
              className="btn-primary px-6 py-3"
              disabled={pending}
              onClick={() => onSend(cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, notes: l.notes })), () => setCart([]))}
            >
              Enviar pedido · {formatBRL(cartTotal)}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Settle({
  c,
  guests,
  pending,
  canCancel,
  act,
  onClosed,
  paymentOptions,
}: {
  c: ComandaView;
  guests: Guest[];
  pending: boolean;
  canCancel: boolean;
  act: (fn: () => Promise<ActionResult>, ok: string, after?: () => void) => void;
  onClosed: () => void;
  paymentOptions: PaymentOptions;
}) {
  const [method, setMethod] = useState<Method>(paymentOptions.methods.includes("DINHEIRO") ? "DINHEIRO" : paymentOptions.methods[0]);
  const [brand, setBrand] = useState("");
  const [given, setGiven] = useState(centsToInput(Math.max(0, c.totals.remaining)));
  const [room, setRoom] = useState(c.guest?.inHouse ? c.guest.reservationId : "");
  const givenCents = parseBRL(given) ?? 0;
  const toRegister = Math.min(givenCents, c.totals.remaining);
  const troco = method === "DINHEIRO" ? change(givenCents, c.totals.remaining) : 0;
  const hasItems = c.totals.total > 0;

  return (
    <section className="card space-y-4 p-4">
      <h2 className="font-semibold">Fechar a conta</h2>

      <div className="rounded-xl bg-blue-50 p-3">
        <h3 className="mb-2 text-sm font-semibold">🛏 Lançar na conta do quarto</h3>
        <div className="flex flex-wrap gap-2">
          <select className="field flex-1" value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">Escolha o hóspede</option>
            {guests.map((g) => (
              <option key={g.reservationId} value={g.reservationId}>Quarto {g.room} — {g.name}</option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={pending || !room || !hasItems || c.totals.remaining <= 0}
            onClick={() => act(() => closeToRoomAction(c.id, room), "Comanda lançada no quarto.", onClosed)}
          >
            Lançar {formatBRL(Math.max(0, c.totals.remaining))}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-emerald-50 p-3">
        <h3 className="mb-2 text-sm font-semibold">💵 Receber aqui</h3>
        <div className="mb-2">
          <PaymentPicker options={paymentOptions} method={method} onMethod={setMethod} brand={brand} onBrand={setBrand} small />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">
            {method === "DINHEIRO" ? "Recebido" : "Valor"} R$
            <input className="field ml-1 inline-block w-28" inputMode="decimal" value={given} onChange={(e) => setGiven(e.target.value)} />
          </label>
          {troco > 0 && <span className="rounded bg-white px-2 py-1 text-sm font-bold">Troco: {formatBRL(troco)}</span>}
          <button
            className="btn bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={pending || toRegister <= 0 || needsBrand(paymentOptions, method, brand)}
            onClick={() => act(() => posPaymentAction(c.id, { method, amount: centsToInput(toRegister), cardBrand: brand }), `Pagamento de ${formatBRL(toRegister)} registrado.`, () => setGiven("0,00"))}
          >
            Registrar {formatBRL(Math.max(0, toRegister))}
          </button>
        </div>
        {c.totals.remaining <= 0 && hasItems && (
          <button className="btn-primary mt-3 w-full py-3" disabled={pending} onClick={() => act(() => closePaidAction(c.id), "Comanda fechada.", onClosed)}>
            ✓ Fechar comanda (paga)
          </button>
        )}
      </div>

      {(!hasItems || canCancel) && c.payments.length === 0 && (
        <button
          className="text-sm text-red-700 underline"
          disabled={pending}
          onClick={() => {
            const reason = prompt("Motivo do cancelamento da comanda:");
            if (reason) act(() => cancelComandaAction(c.id, reason), "Comanda cancelada.", onClosed);
          }}
        >
          Cancelar comanda
        </button>
      )}
    </section>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-bold text-red-700" : ""}`}>
      <dt className="text-zinc-600">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
