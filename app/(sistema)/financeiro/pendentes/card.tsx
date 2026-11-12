"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n";
import { FieldError, FormMessage } from "@/components/field-error";
import { PaymentPicker, needsBrand, type PaymentOptions } from "@/components/payment-picker";
import { formatDate } from "@/lib/dates";
import { centsToInput, formatBRL } from "@/lib/money";
import { METHOD, type Method } from "@/lib/folio/rules";
import type { PendingView } from "@/lib/pending/service";
import type { FieldErrors } from "@/lib/auth/validation";
import { receivePendingAction, writeOffPendingAction } from "./actions";

const STATUS_STYLE = {
  ABERTA: { label: "Em aberto", cls: "bg-amber-100 text-amber-800" },
  QUITADA: { label: "Quitada", cls: "bg-emerald-100 text-emerald-800" },
  BAIXADA: { label: "Baixada (perda)", cls: "bg-zinc-200 text-zinc-700" },
} as const;

export function PendingCard({
  p,
  created,
  canReceive,
  canWriteOff,
  paymentOptions,
}: {
  p: PendingView;
  created: string;
  canReceive: boolean;
  canWriteOff: boolean;
  paymentOptions: PaymentOptions;
}) {
  const tr = useT();
  const router = useRouter();
  const [mode, setMode] = useState<null | "receber" | "baixar">(null);
  const [method, setMethod] = useState<Method>(paymentOptions.methods.includes("PIX") ? "PIX" : paymentOptions.methods[0]);
  const [brand, setBrand] = useState("");
  const [amount, setAmount] = useState(centsToInput(p.remainingCents));
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<{ error?: string; fieldErrors?: FieldErrors; ok?: string }>({});
  const [pending, start] = useTransition();
  const st = STATUS_STYLE[p.status];

  const run = (fn: () => Promise<{ ok: boolean; error?: string; fieldErrors?: FieldErrors }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setState({ ok });
        setMode(null);
        router.refresh();
      } else setState({ error: r.error, fieldErrors: r.fieldErrors });
    });

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <b>{tr("Conta pendente nº {0}", [p.number])}</b>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{tr(st.label)}</span>
          </div>
          <div className="text-sm">
            {p.guest.fullName}
            {p.guest.phone && <span className="text-zinc-500"> · {p.guest.phone}</span>}
            {p.guest.email && <span className="text-zinc-500"> · {p.guest.email}</span>}
          </div>
          <div className="text-xs text-zinc-500">
            <Link href={`/reservas/${p.reservation.id}`} className="text-blue-700 underline">{tr("reserva nº {0}", [p.reservation.number])}</Link>
            {" · "}{tr("quarto {0}", [p.reservation.roomNumber ?? "—"])}{" · "}{formatDate(p.reservation.checkIn)} → {formatDate(p.reservation.checkOut)}
            {" · "}{tr("criada em {0} por {1}", [created, p.createdByName ?? "—"])}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">{p.status === "ABERTA" ? tr("Falta receber") : tr("Valor")}</div>
          <div className="text-xl font-black">{formatBRL(p.status === "ABERTA" ? p.remainingCents : p.amountCents)}</div>
          {p.paidCents > 0 && <div className="text-xs text-zinc-500">{tr("de {0} · recebido {1}", [formatBRL(p.amountCents), formatBRL(p.paidCents)])}</div>}
        </div>
      </div>

      <ul className="mt-2 text-sm text-zinc-700">
        {p.items.map((i, k) => (
          <li key={k} className="flex justify-between gap-2 border-b border-dotted border-zinc-200 py-0.5">
            <span>{i.description}</span>
            <span className="tabular-nums">{formatBRL(i.amountCents)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-zinc-500">{tr("Motivo:")} {p.reason}</p>
      {p.payments.map((x) => (
        <p key={x.id} className="text-xs text-emerald-700">
          ✓ {formatDate(x.businessDate)} · {tr(METHOD[x.method].label)}{x.cardBrand ? ` ${x.cardBrand}` : ""} · {formatBRL(x.amountCents)}{x.userName ? ` · ${x.userName}` : ""}
        </p>
      ))}
      {p.status === "BAIXADA" && <p className="text-xs text-zinc-600">{tr("Baixa por {0}: {1}", [p.closedByName ?? "—", p.closeReason ?? ""])}</p>}

      {p.status === "ABERTA" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canReceive && mode !== "receber" && <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setMode("receber")}>{tr("💵 Receber")}</button>}
          {canWriteOff && mode !== "baixar" && <button className="btn-secondary" onClick={() => setMode("baixar")}>{tr("Dar baixa (perda)")}</button>}
        </div>
      )}

      {mode === "receber" && (
        <form
          className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => receivePendingAction(p.id, { method, amount, reference, cardBrand: brand }), "Pagamento registrado.");
          }}
        >
          <PaymentPicker options={paymentOptions} method={method} onMethod={setMethod} brand={brand} onBrand={setBrand} small />
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-xs text-zinc-500">{tr("Valor (R$)")}</span>
              <input className="field font-bold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <FieldError messages={state.fieldErrors?.amount} />
            </label>
            {method !== "DINHEIRO" && (
              <label>
                <span className="text-xs text-zinc-500">{method === "PIX" ? tr("ID da transação (opcional)") : tr("NSU / autorização (opcional)")}</span>
                <input className="field" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} />
                <FieldError messages={state.fieldErrors?.reference} />
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" disabled={pending || needsBrand(paymentOptions, method, brand)}>{tr("Registrar pagamento")}</button>
            <button type="button" className="btn-secondary" onClick={() => setMode(null)}>{tr("Cancelar")}</button>
          </div>
        </form>
      )}

      {mode === "baixar" && (
        <div className="mt-3 space-y-2 rounded-lg bg-zinc-50 p-3">
          <label className="block">
            <span className="text-xs text-zinc-500">{tr("Por que o hotel não vai cobrar?")}</span>
            <input className="field" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder={tr("Ex.: sem contato com o hóspede há 60 dias")} />
          </label>
          <div className="flex gap-2">
            <button className="btn bg-zinc-700 text-white" disabled={pending} onClick={() => run(() => writeOffPendingAction(p.id, reason), "Baixa registrada.")}>
              {tr("Confirmar baixa de {0}", [formatBRL(p.remainingCents)])}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMode(null)}>{tr("Cancelar")}</button>
          </div>
        </div>
      )}
      <div className="mt-2">
        <FormMessage error={state.fieldErrors ? undefined : state.error} success={state.ok} />
      </div>
    </div>
  );
}
