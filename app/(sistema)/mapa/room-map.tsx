"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHotelEvents } from "@/components/use-hotel-events";
import type { Role } from "@/lib/permissions";
import type { RoomView } from "@/lib/rooms/service";
import { badges, DISPLAY, DISPLAY_ORDER, displayStatus, type DisplayStatus } from "@/lib/rooms/status";
import { RoomPanel } from "./room-panel";
import { formatDate } from "@/lib/dates";

export type Occupant = { reservationId: string; guestName: string; checkOut: string; arriving: boolean };

type Toast = { id: number; text: string };

export function RoomMap({
  initialRooms,
  role,
  occupants,
  today,
  canSeeReservations,
}: {
  initialRooms: RoomView[];
  role: Role;
  occupants: Record<string, Occupant>;
  today: string;
  canSeeReservations: boolean;
}) {
  const router = useRouter();
  // Atualizações recebidas depois do carregamento. Valem só se forem mais
  // novas que o que veio do servidor (evita "voltar no tempo").
  const [updates, setUpdates] = useState<Record<string, RoomView>>({});
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filter, setFilter] = useState<DisplayStatus | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rooms = useMemo(
    () =>
      initialRooms.map((room) => {
        const update = updates[room.id];
        return update && update.updatedAt > room.updatedAt ? update : room;
      }),
    [initialRooms, updates]
  );

  function applyUpdate(room: RoomView) {
    setUpdates((prev) => ({ ...prev, [room.id]: room }));
  }

  const connected = useHotelEvents(
    {
      "room.updated": (data) => {
        const { room, by } = data as { room: RoomView; by: string };
        applyUpdate(room);
        setFlash((prev) => new Set(prev).add(room.id));
        setTimeout(() => setFlash((prev) => { const next = new Set(prev); next.delete(room.id); return next; }), 2500);
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev.slice(-3), { id, text: `Quarto ${room.number}: ${DISPLAY[displayStatus(room)].label} — por ${by}` }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
      },
      "rooms.changed": () => router.refresh(),
      "reservations.changed": () => router.refresh(),
    },
    () => router.refresh()
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(DISPLAY_ORDER.map((s) => [s, 0])) as Record<DisplayStatus, number>;
    for (const room of rooms) c[displayStatus(room)]++;
    return c;
  }, [rooms]);

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b), [rooms]);
  const occupied = rooms.filter((r) => r.occupancy === "OCUPADO").length;
  const sellable = rooms.length - counts.BLOQUEADO - counts.EM_MANUTENCAO;
  const problems = rooms.filter((r) => r.maintenance === "COM_PROBLEMA").length;

  const visible = rooms.filter(
    (r) =>
      (!filter || displayStatus(r) === filter) &&
      (floor === null || r.floor === floor) &&
      (!search ||
        r.number.toLowerCase().includes(search.trim().toLowerCase()) ||
        (occupants[r.id]?.guestName.toLowerCase().includes(search.trim().toLowerCase()) ?? false))
  );

  const selected = rooms.find((r) => r.id === selectedId) ?? null;

  return (
    <div>
      {/* Cabeçalho com números do dia */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mapa de quartos</h1>
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`} />
            {connected ? "Ao vivo — atualiza sozinho" : "Reconectando..."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Stat label="Ocupação" value={`${sellable ? Math.round((occupied / sellable) * 100) : 0}%`} hint={`${occupied} de ${sellable}`} />
          <Stat label="Prontos p/ vender" value={String(counts.LIVRE)} />
          <Stat label="Com problema" value={String(problems)} tone={problems ? "warn" : undefined} />
        </div>
      </div>

      {/* Legenda = filtro */}
      <div className="mb-3 flex flex-wrap gap-2">
        {DISPLAY_ORDER.map((status) => {
          const active = filter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(active ? null : status)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:border-zinc-400"
              } ${filter && !active ? "opacity-50" : ""}`}
            >
              <span className={`h-3 w-3 rounded-full ${DISPLAY[status].dot}`} />
              {DISPLAY[status].label}
              <span className="font-bold">{counts[status]}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Quarto ou hóspede..."
          className="field max-w-48"
          aria-label="Buscar quarto pelo número"
        />
        <div className="flex flex-wrap gap-1">
          <FloorButton active={floor === null} onClick={() => setFloor(null)}>Todos os andares</FloorButton>
          {floors.map((f) => (
            <FloorButton key={f} active={floor === f} onClick={() => setFloor(f)}>
              {f === 0 ? "Térreo" : `${f}º andar`}
            </FloorButton>
          ))}
        </div>
        {(filter || floor !== null || search) && (
          <button type="button" className="text-sm text-blue-700 underline" onClick={() => { setFilter(null); setFloor(null); setSearch(""); }}>
            Limpar filtros
          </button>
        )}
      </div>

      {rooms.length === 0 && (
        <div className="card p-8 text-center text-zinc-500">
          Nenhum quarto cadastrado ainda. Um gerente pode cadastrar em <b>Cadastro de quartos</b>.
        </div>
      )}

      {/* Andares */}
      <div className="space-y-6">
        {floors
          .filter((f) => floor === null || f === floor)
          .map((f) => {
            const list = visible.filter((r) => r.floor === f);
            if (list.length === 0) return null;
            return (
              <section key={f}>
                <h2 className="mb-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">
                  {f === 0 ? "Térreo" : `${f}º andar`}
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
                  {list.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      occupant={occupants[room.id]}
                      today={today}
                      flashing={flash.has(room.id)}
                      onClick={() => setSelectedId(room.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        {rooms.length > 0 && visible.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum quarto com esse filtro.</p>
        )}
      </div>

      {selected && (
        <RoomPanel room={selected} role={role} occupant={occupants[selected.id]} canSeeReservations={canSeeReservations} onClose={() => setSelectedId(null)} onUpdated={applyUpdate} />
      )}

      {/* Avisos do que outros funcionários mudaram */}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomCard({
  room,
  occupant,
  today,
  flashing,
  onClick,
}: {
  room: RoomView;
  occupant?: Occupant;
  today: string;
  flashing: boolean;
  onClick: () => void;
}) {
  const status = displayStatus(room);
  const d = DISPLAY[status];
  const extra = badges(room);

  return (
    <button
      type="button"
      onClick={onClick}
      title={room.note ?? undefined}
      className={`relative flex min-h-24 flex-col rounded-xl border-b-4 p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${d.card} ${
        flashing ? "ring-4 ring-blue-400 ring-offset-2" : ""
      }`}
    >
      <span className="flex items-start justify-between">
        <span className="text-xl leading-none font-black">{room.number}</span>
        <span className="text-sm" aria-hidden>{d.icon}</span>
      </span>
      <span className="mt-1 truncate text-[11px] opacity-90">{room.typeName}</span>
      {occupant && !occupant.arriving && room.occupancy === "OCUPADO" ? (
        <span className="mt-auto truncate text-xs font-semibold" title={occupant.guestName}>
          {lastName(occupant.guestName)} · {occupant.checkOut <= today ? <b className="rounded bg-amber-300 px-1 text-amber-950">sai hoje</b> : `sai ${formatDate(occupant.checkOut)}`}
        </span>
      ) : (
        <span className="mt-auto text-xs font-semibold">{d.label}</span>
      )}
      {occupant?.arriving && (
        <span className="mt-1 truncate rounded bg-sky-100 px-1 py-px text-[10px] font-bold text-sky-800" title={occupant.guestName}>
          ➜ chega hoje: {lastName(occupant.guestName)}
        </span>
      )}
      {extra.length > 0 && (
        <span className="mt-1 flex flex-wrap gap-1">
          {extra.map((b) => (
            <span
              key={b}
              className={`rounded px-1 py-px text-[10px] font-bold ${b.startsWith("⚠") ? "bg-red-100 text-red-700" : "bg-white/80 text-zinc-800"}`}
            >
              {b}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className={`card px-4 py-2 ${tone === "warn" ? "border-red-200 bg-red-50" : ""}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg leading-tight font-bold">
        {value} {hint && <span className="text-xs font-normal text-zinc-500">{hint}</span>}
      </div>
    </div>
  );
}

function FloorButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-3 py-1.5 text-sm ${active ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"}`}
    >
      {children}
    </button>
  );
}

function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
}
