"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { LiveDot, useLiveRefresh } from "@/components/live-refresh";
import { useNow } from "@/components/use-now";
import { dateTime, since } from "@/components/time";
import { canDo, PRIORITY, STATUS_LABEL, type TicketPriority, type TicketStatus } from "@/lib/maintenance/rules";
import type { TicketCard, TicketDetail } from "@/lib/maintenance/service";
import { ticketActionAction, ticketDetailAction } from "./actions";
import { NewTicketForm } from "./new-ticket-form";

type Perms = { report: boolean; work: boolean; cancel: boolean };
type Filter = "todas" | "minhas" | "foraDeVenda";

const COLUMNS: { status: TicketStatus; color: string }[] = [
  { status: "ABERTA", color: "bg-red-500" },
  { status: "EM_ANDAMENTO", color: "bg-blue-600" },
  { status: "AGUARDANDO", color: "bg-violet-500" },
];

export function MaintenanceBoard({
  board,
  rooms,
  serverNow,
  me,
  perms,
  initialTicketId,
  initialNew,
}: {
  board: { open: TicketCard[]; closed: TicketCard[]; staff: { id: string; fullName: string }[] };
  rooms: { id: string; number: string }[];
  serverNow: number;
  me: string;
  perms: Perms;
  initialTicketId: string | null;
  initialNew: { roomId: string } | null;
}) {
  const connected = useLiveRefresh(["maintenance.changed", "rooms.changed", "room.updated"]);
  const now = useNow(serverNow);
  const [filter, setFilter] = useState<Filter>("todas");
  const [selected, setSelected] = useState<string | null>(initialTicketId);
  const [creating, setCreating] = useState<{ roomId: string } | null>(initialNew);
  const closeCreate = useCallback(() => setCreating(null), []);

  const match = (t: TicketCard) =>
    filter === "todas" || (filter === "minhas" && t.assignedToId === me) || (filter === "foraDeVenda" && t.outOfOrder);

  const urgent = board.open.filter((t) => t.priority === "URGENTE").length;
  const outOfOrder = new Set(board.open.filter((t) => t.outOfOrder && t.roomId).map((t) => t.roomId)).size;
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const resolvedToday = board.closed.filter((t) => t.status === "RESOLVIDA" && t.closedAt && Date.parse(t.closedAt) >= startOfDay).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manutenção</h1>
          <LiveDot connected={connected} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Stat label="Abertas" value={board.open.length} />
          <Stat label="Urgentes" value={urgent} warn={urgent > 0} />
          <Stat label="Quartos fora de venda" value={outOfOrder} warn={outOfOrder > 0} />
          <Stat label="Resolvidas hoje" value={resolvedToday} />
          {perms.report && (
            <button type="button" className="btn-primary py-3" onClick={() => setCreating({ roomId: "" })}>
              + Avisar problema
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {(
          [
            ["todas", "Todas"],
            ["minhas", "Minhas"],
            ["foraDeVenda", "Fora de venda"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-lg px-3 py-1.5 text-sm ${filter === value ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = board.open.filter((t) => t.status === col.status && match(t));
          return (
            <Column key={col.status} title={STATUS_LABEL[col.status]} color={col.color} count={list.length}>
              {list.map((t) => (
                <Card key={t.id} ticket={t} now={now} onOpen={() => setSelected(t.id)} />
              ))}
            </Column>
          );
        })}
        <Column title="Encerradas (7 dias)" color="bg-emerald-500" count={board.closed.filter(match).length}>
          {board.closed.filter(match).map((t) => (
            <button key={t.id} type="button" onClick={() => setSelected(t.id)} className="card block w-full p-3 text-left text-sm opacity-80 hover:opacity-100">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">nº {t.number} · {t.place}</span>
                <span className={t.status === "RESOLVIDA" ? "text-emerald-700" : "text-zinc-500"}>{STATUS_LABEL[t.status]}</span>
              </div>
              <div className="truncate text-zinc-600">{t.title}</div>
            </button>
          ))}
        </Column>
      </div>

      {creating && (
        <Drawer title="Avisar problema" onClose={closeCreate}>
          <NewTicketForm rooms={rooms} defaultRoomId={creating.roomId} onDone={closeCreate} />
        </Drawer>
      )}

      {selected && (
        <TicketDrawer
          key={selected}
          ticketId={selected}
          staff={board.staff}
          me={me}
          perms={perms}
          // Recarrega o detalhe quando o painel recebe novidades.
          boardStamp={JSON.stringify(board.open.find((t) => t.id === selected) ?? board.closed.find((t) => t.id === selected) ?? null)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Card({ ticket: t, now, onOpen }: { ticket: TicketCard; now: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="card block w-full p-3 text-left transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-500">nº {t.number}</span>
        <PriorityChip priority={t.priority} />
      </div>
      <div className="mt-1 text-lg leading-tight font-bold">{t.place}</div>
      <div className="text-sm text-zinc-700">{t.title}</div>
      {t.outOfOrder && <div className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">🚫 Fora de venda</div>}
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>{t.assignedToName ?? "Sem responsável"}</span>
        <span>aberta {since(t.createdAt, now)}</span>
      </div>
    </button>
  );
}

function TicketDrawer({
  ticketId,
  staff,
  me,
  perms,
  boardStamp,
  onClose,
}: {
  ticketId: string;
  staff: { id: string; fullName: string }[];
  me: string;
  perms: Perms;
  boardStamp: string;
  onClose: () => void;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null | undefined>(undefined);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<null | "resolver" | "aguardar" | "cancelar" | "comentar">(null);

  useEffect(() => {
    let alive = true;
    ticketDetailAction(ticketId).then((t) => alive && setTicket(t));
    return () => {
      alive = false;
    };
  }, [ticketId, boardStamp]);

  const run = (input: object) =>
    start(async () => {
      setError(null);
      const r = await ticketActionAction(ticketId, input);
      if (!r.ok) setError(r.error ?? "Não foi possível.");
      else {
        setMode(null);
        setText("");
        setTicket(await ticketDetailAction(ticketId));
      }
    });

  if (ticket === undefined) return <Drawer title="Carregando..." onClose={onClose}><p className="text-sm text-zinc-500">Carregando...</p></Drawer>;
  if (ticket === null) return <Drawer title="Ocorrência" onClose={onClose}><p className="text-sm">Ocorrência não encontrada.</p></Drawer>;

  const open = ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO"].includes(ticket.status);
  const placeholders = {
    resolver: "O que foi feito? (ex.: troquei a resistência)",
    aguardar: "Aguardando o quê? (ex.: peça chega amanhã)",
    cancelar: "Motivo do cancelamento",
    comentar: "Escreva um comentário",
  };

  return (
    <Drawer title={`Ocorrência nº ${ticket.number}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityChip priority={ticket.priority} />
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold">{STATUS_LABEL[ticket.status]}</span>
            {ticket.outOfOrder && open && <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">🚫 Fora de venda</span>}
          </div>
          <div className="mt-2 text-xl font-bold">{ticket.place}</div>
          <div className="text-zinc-800">{ticket.title}</div>
          {ticket.description && <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-600">{ticket.description}</p>}
          <div className="mt-2 text-xs text-zinc-500">
            Aberta por {ticket.reportedByName ?? "Sistema"} em {dateTime(ticket.createdAt)} · Responsável: <b>{ticket.assignedToName ?? "ninguém"}</b>
          </div>
          {ticket.resolution && (
            <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800"><b>Solução:</b> {ticket.resolution}</p>
          )}
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {perms.work && open && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {ticket.assignedToId !== me && (
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => run({ action: "assumir" })}>🙋 Eu resolvo</button>
              )}
              {canDo("iniciar", ticket.status) && (
                <button type="button" className="btn bg-blue-600 text-white hover:bg-blue-700" disabled={pending} onClick={() => run({ action: "iniciar" })}>▶ Começar</button>
              )}
              {canDo("aguardar", ticket.status) && (
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => setMode("aguardar")}>⏸ Aguardando</button>
              )}
              <button type="button" className="btn bg-emerald-600 text-white hover:bg-emerald-700" disabled={pending} onClick={() => setMode("resolver")}>✓ Resolvido</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="field text-sm"
                value={ticket.assignedToId ?? ""}
                disabled={pending}
                aria-label="Responsável"
                onChange={(e) => run({ action: "atribuir", userId: e.target.value || null })}
              >
                <option value="">Sem responsável</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
              <select
                className="field text-sm"
                value={ticket.priority}
                disabled={pending}
                aria-label="Prioridade"
                onChange={(e) => run({ action: "prioridade", value: e.target.value })}
              >
                {(Object.keys(PRIORITY) as TicketPriority[]).map((p) => (
                  <option key={p} value={p}>Prioridade {PRIORITY[p].label.toLowerCase()}</option>
                ))}
              </select>
            </div>
            {ticket.roomId && (
              <label className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-sm">
                <input type="checkbox" checked={ticket.outOfOrder} disabled={pending} onChange={(e) => run({ action: "foraDeVenda", value: e.target.checked })} />
                Quarto fora de venda até resolver
              </label>
            )}
          </div>
        )}

        {mode && (
          <form
            className="space-y-2 rounded-lg border border-zinc-200 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              run({ action: mode, message: text });
            }}
          >
            <textarea className="field" rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholders[mode]} maxLength={1000} />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={pending}>Confirmar</button>
              <button type="button" className="btn-secondary" onClick={() => setMode(null)}>Voltar</button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2 text-sm">
          {!mode && (
            <button type="button" className="text-blue-700 underline" onClick={() => setMode("comentar")}>💬 Comentar</button>
          )}
          {perms.work && !open && (
            <button type="button" className="text-blue-700 underline" disabled={pending} onClick={() => run({ action: "reabrir" })}>↺ Reabrir</button>
          )}
          {perms.cancel && open && !mode && (
            <button type="button" className="text-red-700 underline" onClick={() => setMode("cancelar")}>Cancelar ocorrência</button>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Linha do tempo</h3>
          <ol className="space-y-2 text-sm">
            {ticket.events.map((e) => (
              <li key={e.id} className="border-l-2 border-zinc-200 pl-3">
                <div>
                  <b>{EVENT_LABEL[e.type] ?? e.type}</b>
                  {e.message && <span className="text-zinc-700"> — {e.message}</span>}
                </div>
                <div className="text-xs text-zinc-500">{e.userName} · {dateTime(e.createdAt)}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Drawer>
  );
}

const EVENT_LABEL: Record<string, string> = {
  criada: "Aberta",
  atribuida: "Responsável",
  iniciada: "Começou o conserto",
  aguardando: "Aguardando",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
  reaberta: "Reaberta",
  comentario: "Comentário",
  fora_de_venda: "Venda do quarto",
  prioridade: "Prioridade",
};

export function PriorityChip({ priority }: { priority: TicketPriority }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${PRIORITY[priority].chip}`}>{PRIORITY[priority].label}</span>;
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/30 md:items-stretch" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:max-h-none md:w-[28rem] md:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg px-2 py-1 text-xl hover:bg-zinc-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Column({ title, color, count, children }: { title: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <span className={`h-3 w-3 rounded-full ${color}`} />
        {title} <span className="text-zinc-400">{count}</span>
      </h2>
      <div className="space-y-2">
        {children}
        {count === 0 && <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-400">Nada aqui.</p>}
      </div>
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`card px-4 py-2 ${warn ? "border-red-200 bg-red-50" : ""}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg leading-tight font-bold">{value}</div>
    </div>
  );
}
