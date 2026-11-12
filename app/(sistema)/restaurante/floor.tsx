"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LiveDot, useLiveRefresh } from "@/components/live-refresh";
import { useNow } from "@/components/use-now";
import { since } from "@/components/time";
import { FormMessage } from "@/components/field-error";
import { formatBRL } from "@/lib/money";
import type { ComandaView } from "@/lib/restaurant/service";
import { openComandaAction } from "./actions";

import { useT } from "@/components/i18n";
type Guest = { reservationId: string; number: number; name: string; room: string };
type Opening = { tableId: string | null; tableName: string | null; roomService?: boolean };

export function FloorBoard({
  tables,
  open,
  guests,
  serverNow,
  canKitchen,
  canMenu,
}: {
  tables: { id: string; name: string; seats: number }[];
  open: ComandaView[];
  guests: Guest[];
  serverNow: number;
  canKitchen: boolean;
  canMenu: boolean;
}) {
  const tr = useT();
  const connected = useLiveRefresh(["restaurant.changed", "reservations.changed"]);
  const now = useNow(serverNow);
  const [opening, setOpening] = useState<Opening | null>(null);
  const byTable = new Map(open.filter((c) => c.tableId).map((c) => [c.tableId!, c]));
  const loose = open.filter((c) => !c.tableId);
  const busy = byTable.size;
  const pendingKitchen = open.reduce((s, c) => s + c.items.filter((i) => i.status === "PENDENTE" && i.kitchen).length, 0);
  const readyToServe = open.reduce((s, c) => s + c.items.filter((i) => i.status === "PRONTO").length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("Restaurante")}</h1>
          <LiveDot connected={connected} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Stat label={tr("Mesas ocupadas")} value={`${busy} de ${tables.length}`} />
          <Stat label={tr("Na cozinha")} value={String(pendingKitchen)} />
          <Stat label={tr("Prontos p/ levar")} value={String(readyToServe)} warn={readyToServe > 0} />
          {canKitchen && <Link href="/cozinha" className="btn-secondary py-3">{tr("👨‍🍳 Cozinha")}</Link>}
          {canMenu && <Link href="/cardapio" className="btn-secondary py-3">{tr("📋 Cardápio")}</Link>}
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">{tr("Mesas")}</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          {tables.map((t) => {
            const c = byTable.get(t.id);
            if (!c) {
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpening({ tableId: t.id, tableName: t.name })}
                  className="flex min-h-28 flex-col rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-3 text-left hover:border-emerald-500"
                >
                  <span className="text-2xl font-black text-emerald-800">{tr("Mesa")}{" "}{t.name}</span>
                  <span className="text-xs text-emerald-700">{t.seats}{" "}{tr("lugares · livre")}</span>
                  <span className="mt-auto text-sm font-semibold text-emerald-700">{tr("+ Abrir comanda")}</span>
                </button>
              );
            }
            return <TableCard key={t.id} title={tr("Mesa {0}", [t.name])} c={c} now={now} />;
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{tr("Balcão e serviço de quarto")}</h2>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpening({ tableId: null, tableName: null })}>{tr("+ Comanda no balcão")}</button>
            <button type="button" className="btn-secondary" onClick={() => setOpening({ tableId: null, tableName: null, roomService: true })}>{tr("🛎 Serviço de quarto")}</button>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          {loose.map((c) => (
            <TableCard key={c.id} title={c.guest?.room ? tr("Quarto {0}", [c.guest.room]) : c.customerName || tr("Balcão")} c={c} now={now} />
          ))}
          {loose.length === 0 && <p className="text-sm text-zinc-400">{tr("Nenhuma comanda aberta fora das mesas.")}</p>}
        </div>
      </section>

      {opening && <OpenDialog opening={opening} guests={guests} onClose={() => setOpening(null)} />}
    </div>
  );
}

function TableCard({ title, c, now }: { title: string; c: ComandaView; now: number }) {
  const tr = useT();
  const ready = c.items.filter((i) => i.status === "PRONTO").length;
  const cooking = c.items.filter((i) => i.status === "PENDENTE").length;
  return (
    <Link href={`/restaurante/comanda/${c.id}`} className={`flex min-h-28 flex-col rounded-2xl border-b-4 p-3 text-white shadow-sm hover:-translate-y-0.5 ${ready ? "border-emerald-700 bg-emerald-600" : "border-orange-700 bg-orange-500"}`}>
      <span className="text-xl leading-tight font-black">{tr(title)}</span>
      <span className="text-xs opacity-90">{tr("nº {0} · {1} pess. · {2}", [c.number, c.people, since(c.openedAt, now, tr)])}</span>
      {c.guest && <span className="truncate text-xs">🛏 {c.guest.room} {c.guest.name.split(" ")[0]}</span>}
      <span className="mt-auto text-lg font-bold">{formatBRL(c.totals.total)}</span>
      {(ready > 0 || cooking > 0) && (
        <span className="text-[11px] font-semibold">
          {ready > 0 && tr("✓ {0} pronto(s) ", [ready])}
          {cooking > 0 && tr("⏳ {0} na cozinha", [cooking])}
        </span>
      )}
    </Link>
  );
}

function OpenDialog({ opening, guests, onClose }: { opening: Opening; guests: Guest[]; onClose: () => void }) {
  const tr = useT();
  const router = useRouter();
  const [people, setPeople] = useState(2);
  const [guestId, setGuestId] = useState("");
  const [name, setName] = useState("");
  const [serviceFee, setServiceFee] = useState(!opening.roomService);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-bold">
          {opening.tableName ? tr("Abrir comanda — Mesa {0}", [opening.tableName]) : opening.roomService ? tr("Serviço de quarto") : tr("Comanda no balcão")}
        </h2>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">{tr("Hóspede")}{" "}{opening.roomService ? "*" : tr("(opcional — para lançar no quarto)")}</span>
            <select className="field" value={guestId} onChange={(e) => setGuestId(e.target.value)}>
              <option value="">{opening.roomService ? tr("Escolha o quarto") : tr("Cliente de fora / decidir depois")}</option>
              {guests.map((g) => (
                <option key={g.reservationId} value={g.reservationId}>{tr("Quarto {0} —", [g.room])}{" "}{g.name}</option>
              ))}
            </select>
          </label>
          {!guestId && !opening.roomService && (
            <label className="block">
              <span className="text-xs text-zinc-500">{tr("Nome do cliente (opcional)")}</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </label>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">{tr("Pessoas")}<input type="number" min={1} max={50} className="field w-20" value={people} onChange={(e) => setPeople(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={serviceFee} onChange={(e) => setServiceFee(e.target.checked)} />{" "}{tr("Taxa de serviço")}</label>
          </div>
          <FormMessage error={error ?? undefined} />
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1 py-3"
              disabled={pending || (opening.roomService && !guestId)}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await openComandaAction({ tableId: opening.tableId ?? "", reservationId: guestId, customerName: name, people, serviceFee });
                  if (r.ok && r.id) router.push(`/restaurante/comanda/${r.id}`);
                  else setError(r.error ?? "Não foi possível.");
                })
              }
            >{tr("Abrir comanda")}</button>
            <button className="btn-secondary" onClick={onClose}>{tr("Cancelar")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const tr = useT();
  return (
    <div className={`card px-4 py-2 ${warn ? "border-emerald-300 bg-emerald-50" : ""}`}>
      <div className="text-xs text-zinc-500">{tr(label)}</div>
      <div className="text-lg leading-tight font-bold">{value}</div>
    </div>
  );
}
