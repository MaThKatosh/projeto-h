"use client";

import { useState, useTransition } from "react";
import { FieldError, FormMessage } from "@/components/field-error";
import { dateTime } from "@/components/time";
import type { FieldErrors } from "@/lib/auth/validation";
import type { FolioView, FolioEntryView } from "@/lib/folio/service";
import { CATEGORY_LABEL, MANUAL_CATEGORIES, METHOD, METHODS, type Category, type Method } from "@/lib/folio/rules";
import { formatDate } from "@/lib/dates";
import { centsToInput, formatBRL } from "@/lib/money";
import { addChargeAction, addPaymentAction, postNightsAction, refundAction, reverseAction, type ActionResult } from "../actions";

type Mode = null | "cobranca" | "pagamento" | "devolucao";

// ================================================================
// CONTA DO QUARTO (na tela da reserva)
// ================================================================

export function Folio({
  reservationId,
  folio,
  status,
  canPost,
  canReverse,
  onDone,
}: {
  reservationId: string;
  folio: FolioView;
  status: string;
  canPost: boolean;
  canReverse: boolean;
  onDone: (msg: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [reversing, setReversing] = useState<FolioEntryView | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = status === "HOSPEDADA" || status === "CONFIRMADA";
  // Ao concluir uma ação, fecha o formulário dela.
  const finish = (msg: string) => {
    setMode(null);
    setReversing(null);
    onDone(msg);
  };
  const inHouse = status === "HOSPEDADA";

  const postNights = () =>
    start(async () => {
      setError(null);
      const r = await postNightsAction(reservationId, false);
      if (r.ok) finish("Diárias lançadas na conta.");
      else setError(r.error ?? "Não foi possível.");
    });

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Conta do quarto</h2>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-zinc-600">
            <span>Cobranças: <b>{formatBRL(folio.charges)}</b></span>
            <span>Pagamentos: <b>{formatBRL(folio.payments)}</b></span>
          </div>
        </div>
        <Balance balance={folio.balance} />
      </div>

      {inHouse && folio.pendingNights.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            {folio.pendingNights.length} diária(s) vencida(s) ainda não lançada(s): {folio.pendingNights.map((n) => formatDate(n)).join(", ")}.
            <span className="block text-xs">Normalmente a auditoria noturna lança sozinha; estas ficaram para trás.</span>
          </span>
          {canPost && (
            <button className="btn-secondary" disabled={pending} onClick={postNights}>Lançar agora</button>
          )}
        </div>
      )}

      {canPost && open && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setMode("pagamento")}>💵 Receber pagamento</button>
          <button className="btn-secondary" onClick={() => setMode("cobranca")}>+ Lançar cobrança</button>
          {folio.balance < 0 && <button className="btn-secondary" onClick={() => setMode("devolucao")}>↩ Devolver crédito</button>}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {mode === "pagamento" && (
        <PaymentForm reservationId={reservationId} suggested={Math.max(0, folio.balance + (inHouse ? folio.checkoutPreview : 0))} onClose={() => setMode(null)} onDone={finish} />
      )}
      {mode === "cobranca" && <ChargeForm reservationId={reservationId} onClose={() => setMode(null)} onDone={finish} />}
      {mode === "devolucao" && <RefundForm reservationId={reservationId} credit={-folio.balance} onClose={() => setMode(null)} onDone={finish} />}
      {reversing && <ReverseForm entry={reversing} onClose={() => setReversing(null)} onDone={finish} />}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr className="border-b border-zinc-200">
              <th className="py-2 pr-2">Data</th>
              <th className="py-2 pr-2">Lançamento</th>
              <th className="py-2 pr-2 text-right">Cobrança</th>
              <th className="py-2 pr-2 text-right">Pagamento</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {folio.entries.map((e) => {
              const reversed = Boolean(e.reversedAt);
              const isReversal = Boolean(e.reversalOfId);
              return (
                <tr key={e.id} className={`border-b border-zinc-100 ${reversed ? "text-zinc-400 line-through decoration-zinc-300" : ""} ${isReversal ? "bg-red-50/60" : ""}`}>
                  <td className="py-2 pr-2 align-top text-xs whitespace-nowrap">
                    {formatDate(e.businessDate)}
                    <div className="text-zinc-400">{e.createdByName}</div>
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {e.kind === "PAGAMENTO" && e.method ? (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold no-underline ${METHOD[e.method].color}`}>{METHOD[e.method].icon} {METHOD[e.method].label}</span>
                      ) : (
                        e.category && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700">{CATEGORY_LABEL[e.category]}</span>
                      )}
                      <span>{e.description}</span>
                      {e.quantity > 1 && e.unitCents && <span className="text-xs text-zinc-500">({e.quantity} × {formatBRL(e.unitCents)})</span>}
                    </div>
                    {e.reference && <div className="text-xs text-zinc-500">ref. {e.reference}</div>}
                    {reversed && (
                      <div className="text-xs text-red-700 no-underline" style={{ textDecoration: "none" }}>
                        Estornado por {e.reversedByName} em {dateTime(e.reversedAt!)}: {e.reverseReason}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right align-top whitespace-nowrap">{e.kind === "COBRANCA" ? formatBRL(e.amountCents) : ""}</td>
                  <td className="py-2 pr-2 text-right align-top whitespace-nowrap">{e.kind === "PAGAMENTO" ? formatBRL(e.amountCents) : ""}</td>
                  <td className="py-2 text-right align-top">
                    {canReverse && open && !reversed && !isReversal && (
                      <button className="text-xs text-red-700 underline" onClick={() => setReversing(e)}>estornar</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {folio.entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-zinc-400">Nenhum lançamento ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Balance({ balance }: { balance: number }) {
  if (balance === 0) return <div className="rounded-xl bg-emerald-50 px-4 py-2 text-right"><div className="text-xs text-emerald-700">Saldo</div><div className="text-2xl font-black text-emerald-700">Zerada ✓</div></div>;
  const owes = balance > 0;
  return (
    <div className={`rounded-xl px-4 py-2 text-right ${owes ? "bg-red-50" : "bg-sky-50"}`}>
      <div className={`text-xs ${owes ? "text-red-700" : "text-sky-700"}`}>{owes ? "A pagar" : "Crédito do hóspede"}</div>
      <div className={`text-2xl font-black ${owes ? "text-red-700" : "text-sky-700"}`}>{formatBRL(Math.abs(balance))}</div>
    </div>
  );
}

// ----------------------------------------------------------------

type FormProps = { onClose: () => void; onDone: (msg: string) => void };

function useSubmit() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; fieldErrors?: FieldErrors }>({});
  const submit = (fn: () => Promise<ActionResult>, ok: string, onDone: (m: string) => void) =>
    start(async () => {
      setState({});
      const r = await fn();
      if (r.ok) onDone(ok);
      else setState({ error: r.error, fieldErrors: r.fieldErrors });
    });
  return { pending, state, submit };
}

function Frame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border-2 border-blue-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded px-2 text-lg hover:bg-zinc-100">✕</button>
      </div>
      {children}
    </div>
  );
}

export function PaymentForm({ reservationId, suggested, onClose, onDone }: FormProps & { reservationId: string; suggested: number }) {
  const [method, setMethod] = useState<Method>("PIX");
  const [amount, setAmount] = useState(suggested > 0 ? centsToInput(suggested) : "");
  const [reference, setReference] = useState("");
  const [installments, setInstallments] = useState(1);
  const { pending, state, submit } = useSubmit();

  return (
    <Frame title="Receber pagamento" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => addPaymentAction(reservationId, { method, amount, reference, installments }), "Pagamento registrado.", onDone);
        }}
      >
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              onClick={() => setMethod(m)}
              className={`rounded-lg border-2 px-3 py-2 text-sm font-medium ${method === m ? "border-blue-600 bg-blue-50" : "border-zinc-200 hover:border-zinc-400"}`}
            >
              {METHOD[m].icon} {METHOD[m].label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="text-xs text-zinc-500">Valor (R$)</span>
            <input className="field text-lg font-bold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            <FieldError messages={state.fieldErrors?.amount} />
          </label>
          {method !== "DINHEIRO" && (
            <label>
              <span className="text-xs text-zinc-500">{method === "PIX" ? "ID da transação (opcional)" : "NSU / autorização (opcional)"}</span>
              <input className="field" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} />
              <FieldError messages={state.fieldErrors?.reference} />
            </label>
          )}
          {method === "CREDITO" && (
            <label>
              <span className="text-xs text-zinc-500">Parcelas</span>
              <select className="field" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x`}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {(method === "CREDITO" || method === "DEBITO") && (
          <p className="text-xs text-zinc-500">O pagamento é feito na maquininha. Aqui só se registra — nunca digite o número do cartão.</p>
        )}
        <FormMessage error={state.fieldErrors ? undefined : state.error} />
        <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" disabled={pending}>{pending ? "Registrando..." : "Registrar pagamento"}</button>
      </form>
    </Frame>
  );
}

function ChargeForm({ reservationId, onClose, onDone }: FormProps & { reservationId: string }) {
  const [category, setCategory] = useState<Category>("OUTRO");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("");
  const { pending, state, submit } = useSubmit();
  return (
    <Frame title="Lançar cobrança" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => addChargeAction(reservationId, { category, description, quantity, unit }), "Cobrança lançada.", onDone);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className="text-xs text-zinc-500">Tipo</span>
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {MANUAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs text-zinc-500">Descrição</span>
            <input className="field" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Lavanderia 2 camisas" />
            <FieldError messages={state.fieldErrors?.description} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="text-xs text-zinc-500">Qtd.</span>
              <input className="field" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </label>
            <label>
              <span className="text-xs text-zinc-500">Valor un.</span>
              <input className="field" inputMode="decimal" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="0,00" />
            </label>
          </div>
        </div>
        <FieldError messages={state.fieldErrors?.unit} />
        <p className="text-xs text-zinc-500">Diárias, ISS e estacionamento são lançados pelo sistema. Frigobar e restaurante terão telas próprias na Fase 5.</p>
        <FormMessage error={state.fieldErrors ? undefined : state.error} />
        <button className="btn-primary" disabled={pending}>Lançar cobrança</button>
      </form>
    </Frame>
  );
}

function RefundForm({ reservationId, credit, onClose, onDone }: FormProps & { reservationId: string; credit: number }) {
  const [method, setMethod] = useState<Method>("DINHEIRO");
  const [amount, setAmount] = useState(centsToInput(credit));
  const [reason, setReason] = useState("Troco / pagamento a mais");
  const { pending, state, submit } = useSubmit();
  return (
    <Frame title={`Devolver crédito (${formatBRL(credit)})`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => refundAction(reservationId, { method, amount, reason }), "Devolução registrada.", onDone);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="text-xs text-zinc-500">Devolver em</span>
            <select className="field" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{METHOD[m].label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-zinc-500">Valor</span>
            <input className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <FieldError messages={state.fieldErrors?.amount} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">Motivo</span>
            <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            <FieldError messages={state.fieldErrors?.reason} />
          </label>
        </div>
        <FormMessage error={state.fieldErrors ? undefined : state.error} />
        <button className="btn-primary" disabled={pending}>Registrar devolução</button>
      </form>
    </Frame>
  );
}

function ReverseForm({ entry, onClose, onDone }: FormProps & { entry: FolioEntryView }) {
  const [reason, setReason] = useState("");
  const { pending, state, submit } = useSubmit();
  return (
    <Frame title="Estornar lançamento" onClose={onClose}>
      <p className="mb-2 text-sm">
        <b>{entry.description}</b> — {formatBRL(entry.amountCents)} ({entry.kind === "COBRANCA" ? "cobrança" : "pagamento"} de {formatDate(entry.businessDate)})
      </p>
      <p className="mb-3 text-xs text-zinc-500">
        O lançamento não é apagado: fica riscado e um estorno com valor negativo entra na conta, com o seu nome e o motivo.
      </p>
      <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (ex.: diária lançada em duplicidade)" maxLength={300} autoFocus />
      <FormMessage error={state.error} />
      <button
        className="btn mt-3 bg-red-600 text-white hover:bg-red-700"
        disabled={pending || reason.trim().length < 5}
        onClick={() => submit(() => reverseAction(entry.id, reason), "Lançamento estornado.", onDone)}
      >
        Confirmar estorno
      </button>
    </Frame>
  );
}
