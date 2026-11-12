"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LiveDot, useLiveRefresh } from "@/components/live-refresh";
import { useNow } from "@/components/use-now";
import { clock, duration, since } from "@/components/time";
import type { CleaningCard, HousekeepingBoard as Board } from "@/lib/housekeeping/service";
import { cleaningActionAction } from "./actions";

import { useT } from "@/components/i18n";
type Filter = "todos" | "meus" | "livres";

export function HousekeepingBoard({
  board,
  serverNow,
  me,
  canWork,
  canAssign,
  canMinibar,
}: {
  board: Board;
  serverNow: number;
  me: { id: string; isHousekeeper: boolean };
  canWork: boolean;
  canAssign: boolean;
  canMinibar: boolean;
}) {
  const tr = useT();
  const connected = useLiveRefresh(["room.updated", "rooms.changed", "housekeeping.changed", "reservations.changed"]);
  const now = useNow(serverNow);
  const [filter, setFilter] = useState<Filter>(me.isHousekeeper ? "meus" : "todos");
  const [error, setError] = useState<string | null>(null);

  const match = (c: CleaningCard) =>
    filter === "todos" ||
    (filter === "meus" && (c.assignedToId === me.id || c.assignedToId === null)) ||
    (filter === "livres" && c.room.occupancy === "LIVRE");

  const pending = board.open.filter((c) => c.status === "PENDENTE");
  const doing = board.open.filter((c) => c.status === "EM_ANDAMENTO");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("Governança")}</h1>
          <LiveDot connected={connected} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Stat label={tr("Para arrumar")} value={pending.length} tone="amber" />
          <Stat label={tr("Em arrumação")} value={doing.length} tone="orange" />
          <Stat label={tr("Limpos hoje")} value={board.doneToday.length} tone="emerald" />
          <Stat label={tr("Tempo médio hoje")} value={board.avgMinutesToday === null ? "—" : `${board.avgMinutesToday} min`} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {(
          [
            ["meus", me.isHousekeeper ? "Meus e sem responsável" : "Sem responsável"],
            ["livres", "Só quartos livres"],
            ["todos", "Todos"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-lg px-3 py-1.5 text-sm ${filter === value ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"}`}
          >
            {tr(label)}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {tr(error)}{" "}
          <button type="button" className="underline" onClick={() => setError(null)}>{tr("ok")}</button>
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Column title={tr("Para arrumar")} color="bg-amber-300" count={pending.filter(match).length}>
          {pending.filter(match).map((c) => (
            <TaskCard key={c.id} card={c} now={now} staff={board.staff} me={me} canWork={canWork} canAssign={canAssign} canMinibar={canMinibar} onError={setError} />
          ))}
        </Column>
        <Column title={tr("Em arrumação")} color="bg-orange-500" count={doing.filter(match).length}>
          {doing.filter(match).map((c) => (
            <TaskCard key={c.id} card={c} now={now} staff={board.staff} me={me} canWork={canWork} canAssign={canAssign} canMinibar={canMinibar} onError={setError} />
          ))}
        </Column>
        <Column title={tr("Limpos hoje")} color="bg-emerald-500" count={board.doneToday.length}>
          {board.doneToday.map((c) => (
            <div key={c.id} className="card flex items-center justify-between gap-2 p-3 text-sm">
              <div>
                <span className="text-lg font-black">{c.room.number}</span>{" "}
                <span className="text-zinc-500">{c.finishedByName ?? c.assignedToName ?? "—"}</span>
              </div>
              <div className="text-right text-xs text-zinc-500">
                {c.finishedAt && clock(c.finishedAt)}
                {c.startedAt && c.finishedAt && <div>{tr("levou")}{" "}{duration(c.startedAt, c.finishedAt)}</div>}
              </div>
            </div>
          ))}
        </Column>
      </div>
    </div>
  );
}

function TaskCard({
  card,
  now,
  staff,
  me,
  canWork,
  canAssign,
  canMinibar,
  onError,
}: {
  card: CleaningCard;
  now: number;
  staff: { id: string; fullName: string }[];
  me: { id: string; isHousekeeper: boolean };
  canWork: boolean;
  canAssign: boolean;
  canMinibar: boolean;
  onError: (msg: string | null) => void;
}) {
  const tr = useT();
  const [pending, start] = useTransition();
  const doing = card.status === "EM_ANDAMENTO";
  const blocked = card.room.maintenance === "EM_MANUTENCAO" || card.room.maintenance === "BLOQUEADO";

  const run = (input: object) =>
    start(async () => {
      onError(null);
      const r = await cleaningActionAction(card.id, input);
      if (!r.ok) onError(r.error ?? "Não foi possível.");
    });

  return (
    <div className={`card p-3 ${card.priority || card.arrivingToday ? "border-2 border-blue-500" : ""} ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl leading-none font-black">{card.room.number}</span>
            {card.priority && <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-bold text-white">{tr("★ Prioridade")}</span>}
            {card.arrivingToday && <span className="rounded bg-sky-600 px-1.5 py-0.5 text-xs font-bold text-white">{tr("➜ Chega hoje")}</span>}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {card.room.typeName} · {card.room.floor === 0 ? tr("Térreo") : tr("{0}º andar", [card.room.floor])}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            card.room.occupancy === "LIVRE" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
          }`}
          title={card.room.occupancy === "LIVRE" ? tr("Vazio: pode ser vendido assim que ficar limpo") : tr("Hóspede hospedado")}
        >
          {card.room.occupancy === "LIVRE" ? tr("Vazio") : tr("Com hóspede")}
        </span>
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-zinc-600">
        <div>
          {doing && card.startedAt ? tr("Arrumando {0}", [since(card.startedAt, now, tr)]) : tr("Esperando {0}", [since(card.createdAt, now, tr)])}
        </div>
        <div>{tr("Responsável:")}{" "}<b>{card.assignedToName ?? tr("ninguém")}</b></div>
        {card.room.maintenance === "COM_PROBLEMA" && <div className="text-red-700">{tr("⚠ Tem problema aberto na manutenção")}</div>}
        {blocked && <div className="font-semibold text-red-700">{tr("🔧 Em manutenção/bloqueado: aguarde liberar")}</div>}
      </div>

      {canWork && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!doing ? (
            <button type="button" className="btn flex-1 bg-orange-500 py-3 text-white hover:bg-orange-600" disabled={pending || blocked} onClick={() => run({ action: "comecar" })}>{tr("▶ Começar")}</button>
          ) : (
            <>
              <button type="button" className="btn flex-1 bg-emerald-600 py-3 text-white hover:bg-emerald-700" disabled={pending || blocked} onClick={() => run({ action: "terminar" })}>{tr("✓ Terminei")}</button>
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => run({ action: "devolver" })} title={tr("Parou no meio: volta para 'Para arrumar'")}>{tr("Parar")}</button>
            </>
          )}
          {me.isHousekeeper && !card.assignedToId && (
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => run({ action: "pegar" })}>{tr("Eu arrumo")}</button>
          )}
          {canMinibar && card.room.occupancy === "OCUPADO" && (
            <Link href={`/frigobar?quarto=${encodeURIComponent(card.room.number)}`} className="btn-secondary" title={tr("Conferir o frigobar deste quarto")}>{tr("🧃 Frigobar")}</Link>
          )}
        </div>
      )}

      {canAssign && (
        <div className="mt-2 flex gap-2">
          <select
            className="field py-1.5 text-xs"
            value={card.assignedToId ?? ""}
            disabled={pending}
            aria-label={tr("Responsável pelo quarto {0}", [card.room.number])}
            onChange={(e) => run({ action: "atribuir", userId: e.target.value || null })}
          >
            <option value="">{tr("Sem responsável")}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
          <button
            type="button"
            className={`btn px-3 py-1.5 text-xs ${card.priority ? "bg-blue-600 text-white" : "border border-zinc-300 bg-white"}`}
            disabled={pending}
            aria-pressed={card.priority}
            onClick={() => run({ action: "prioridade", value: !card.priority })}
            title={tr("Marcar como prioridade (ex.: hóspede chegando)")}
          >
            ★
          </button>
        </div>
      )}
    </div>
  );
}

function Column({ title, color, count, children }: { title: string; color: string; count: number; children: React.ReactNode }) {
  const tr = useT();
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <span className={`h-3 w-3 rounded-full ${color}`} />
        {tr(title)} <span className="text-zinc-400">{count}</span>
      </h2>
      <div className="space-y-2">
        {children}
        {count === 0 && <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-400">{tr("Nada aqui.")}</p>}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "amber" | "orange" | "emerald" }) {
  const tr = useT();
  const bar = tone === "amber" ? "border-l-amber-300" : tone === "orange" ? "border-l-orange-500" : tone === "emerald" ? "border-l-emerald-500" : "border-l-zinc-300";
  return (
    <div className={`card border-l-4 px-4 py-2 ${bar}`}>
      <div className="text-xs text-zinc-500">{tr(label)}</div>
      <div className="text-lg leading-tight font-bold">{value}</div>
    </div>
  );
}
