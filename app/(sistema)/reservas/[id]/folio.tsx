"use client";

import { useState, useTransition } from "react";
import { FieldError, FormMessage } from "@/components/field-error";
import { dateTime } from "@/components/time";
import type { FieldErrors } from "@/lib/auth/validation";
import type { FolioView, FolioEntryView } from "@/lib/folio/service";
import { CATEGORY_LABEL, MANUAL_CATEGORIES, METHOD, METHODS, type Category, type Method } from "@/lib/folio/rules";
import { needsBrand, PaymentPicker, type PaymentOptions } from "@/components/payment-picker";
import { formatDate } from "@/lib/dates";
import { centsToInput, formatBRL } from "@/lib/money";
import { addChargeAction, addPaymentAction, postNightsAction, refundAction, reverseAction, type ActionResult } from "../actions";

import { useT } from "@/components/i18n";
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
  options,
  onDone,
}: {
  reservationId: string;
  options: PaymentOptions;
  folio: FolioView;
  status: string;
  canPost: boolean;
  canReverse: boolean;
  onDone: (msg: string) => void;
}) {
  const tr = useT();
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
          <h2 className="font-semibold">{tr("Conta do quarto")}</h2>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-zinc-600">
            <span>{tr("Cobranças:")}{" "}<b>{formatBRL(folio.charges)}</b></span>
            <span>{tr("Pagamentos:")}{" "}<b>{formatBRL(folio.payments)}</b></span>
          </div>
        </div>
        <Balance balance={folio.balance} />
      </div>

      {inHouse && folio.pendingNights.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <span>{tr("{0} diária(s) vencida(s) ainda não lançada(s): {1}.", [folio.pendingNights.length, folio.pendingNights.map((n) => formatDate(n)).join(", ")])}<span className="block text-xs">{tr("Normalmente a auditoria noturna lança sozinha; estas ficaram para trás.")}</span>
          </span>
          {canPost && (
            <button className="btn-secondary" disabled={pending} onClick={postNights}>{tr("Lançar agora")}</button>
          )}
        </div>
      )}

      {canPost && open && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setMode("pagamento")}>{tr("💵 Receber pagamento")}</button>
          <button className="btn-secondary" onClick={() => setMode("cobranca")}>{tr("+ Lançar cobrança")}</button>
          {folio.balance < 0 && <button className="btn-secondary" onClick={() => setMode("devolucao")}>{tr("↩ Devolver crédito")}</button>}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{tr(error)}</p>}

      {mode === "pagamento" && (
        <PaymentForm reservationId={reservationId} suggested={Math.max(0, folio.balance + (inHouse ? folio.checkoutPreview : 0))} options={options} onClose={() => setMode(null)} onDone={finish} />
      )}
      {mode === "cobranca" && <ChargeForm reservationId={reservationId} onClose={() => setMode(null)} onDone={finish} />}
      {mode === "devolucao" && <RefundForm reservationId={reservationId} credit={-folio.balance} onClose={() => setMode(null)} onDone={finish} />}
      {reversing && <ReverseForm entry={reversing} onClose={() => setReversing(null)} onDone={finish} />}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr className="border-b border-zinc-200">
              <th className="py-2 pr-2">{tr("Data")}</th>
              <th className="py-2 pr-2">{tr("Lançamento")}</th>
              <th className="py-2 pr-2 text-right">{tr("Cobrança")}</th>
              <th className="py-2 pr-2 text-right">{tr("Pagamento")}</th>
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
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold no-underline ${METHOD[e.method].color}`}>{tr(METHOD[e.method].icon)} {tr(METHOD[e.method].label)}</span>
                      ) : (
                        e.category && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700">{tr(CATEGORY_LABEL[e.category])}</span>
                      )}
                      <span>{e.description}</span>
                      {e.quantity > 1 && e.unitCents && <span className="text-xs text-zinc-500">{tr("({0} × {1})", [e.quantity, formatBRL(e.unitCents)])}</span>}
                    </div>
                    {e.reference && <div className="text-xs text-zinc-500">{tr("ref.")}{" "}{e.reference}</div>}
                    {reversed && (
                      <div className="text-xs text-red-700 no-underline" style={{ textDecoration: "none" }}>{tr("Estornado por {0} em {1}: {2}", [e.reversedByName, dateTime(e.reversedAt!), e.reverseReason])}</div>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right align-top whitespace-nowrap">{e.kind === "COBRANCA" ? formatBRL(e.amountCents) : ""}</td>
                  <td className="py-2 pr-2 text-right align-top whitespace-nowrap">{e.kind === "PAGAMENTO" ? formatBRL(e.amountCents) : ""}</td>
                  <td className="py-2 text-right align-top">
                    {canReverse && open && !reversed && !isReversal && (
                      <button className="text-xs text-red-700 underline" onClick={() => setReversing(e)}>{tr("estornar")}</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {folio.entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-zinc-400">{tr("Nenhum lançamento ainda.")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Balance({ balance }: { balance: number }) {
  const tr = useT();
  if (balance === 0) return <div className="rounded-xl bg-emerald-50 px-4 py-2 text-right"><div className="text-xs text-emerald-700">{tr("Saldo")}</div><div className="text-2xl font-black text-emerald-700">{tr("Zerada ✓")}</div></div>;
  const owes = balance > 0;
  return (
    <div className={`rounded-xl px-4 py-2 text-right ${owes ? "bg-red-50" : "bg-sky-50"}`}>
      <div className={`text-xs ${owes ? "text-red-700" : "text-sky-700"}`}>{owes ? tr("A pagar") : tr("Crédito do hóspede")}</div>
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
  const tr = useT();
  return (
    <div className="mt-4 rounded-xl border-2 border-blue-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{tr(title)}</h3>
        <button type="button" onClick={onClose} aria-label={tr("Fechar")} className="rounded px-2 text-lg hover:bg-zinc-100">✕</button>
      </div>
      {children}
    </div>
  );
}

export function PaymentForm({
  reservationId,
  suggested,
  options,
  onClose,
  onDone,
}: FormProps & { reservationId: string; suggested: number; options: PaymentOptions }) {
  const tr = useT();
  const [method, setMethod] = useState<Method>(options.methods.includes("PIX") ? "PIX" : options.methods[0]);
  const [brand, setBrand] = useState("");
  const [amount, setAmount] = useState(suggested > 0 ? centsToInput(suggested) : "");
  const [reference, setReference] = useState("");
  const [installments, setInstallments] = useState(1);
  const { pending, state, submit } = useSubmit();
  const missingBrand = needsBrand(options, method, brand);

  return (
    <Frame title={tr("Receber pagamento")} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => addPaymentAction(reservationId, { method, amount, reference, installments, cardBrand: brand }), "Pagamento registrado.", onDone);
        }}
      >
        <PaymentPicker options={options} method={method} onMethod={setMethod} brand={brand} onBrand={setBrand} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="text-xs text-zinc-500">{tr("Valor (R$)")}</span>
            <input className="field text-lg font-bold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            <FieldError messages={state.fieldErrors?.amount} />
          </label>
          {method !== "DINHEIRO" && (
            <label>
              <span className="text-xs text-zinc-500">{method === "PIX" ? tr("ID da transação (opcional)") : tr("NSU / autorização (opcional)")}</span>
              <input className="field" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} />
              <FieldError messages={state.fieldErrors?.reference} />
            </label>
          )}
          {method === "CREDITO" && (
            <label>
              <span className="text-xs text-zinc-500">{tr("Parcelas")}</span>
              <select className="field" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n === 1 ? tr("À vista") : tr("{0}x", [n])}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {(method === "CREDITO" || method === "DEBITO") && (
          <p className="text-xs text-zinc-500">{tr("O pagamento é feito na maquininha. Aqui só se registra — nunca digite o número do cartão.")}</p>
        )}
        <FormMessage error={state.fieldErrors ? undefined : state.error} />
        {missingBrand && <p className="text-xs text-amber-700">{tr("Escolha a bandeira do cartão.")}</p>}
        <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" disabled={pending || missingBrand}>{pending ? tr("Registrando...") : tr("Registrar pagamento")}</button>
      </form>
    </Frame>
  );
}

function ChargeForm({ reservationId, onClose, onDone }: FormProps & { reservationId: string }) {
  const tr = useT();
  const [category, setCategory] = useState<Category>("OUTRO");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("");
  const { pending, state, submit } = useSubmit();
  return (
    <Frame title={tr("Lançar cobrança")} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => addChargeAction(reservationId, { category, description, quantity, unit }), "Cobrança lançada.", onDone);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            <span className="text-xs text-zinc-500">{tr("Tipo")}</span>
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {MANUAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{tr(CATEGORY_LABEL[c])}</option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs text-zinc-500">{tr("Descrição")}</span>
            <input className="field" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} placeholder={tr("Ex.: Lavanderia 2 camisas")} />
            <FieldError messages={state.fieldErrors?.description} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="text-xs text-zinc-500">{tr("Qtd.")}</span>
              <input className="field" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </label>
            <label>
              <span className="text-xs text-zinc-500">{tr("Valor un.")}</span>
              <input className="field" inputMode="decimal" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="0,00" />
            </label>
          </div>
        </div>
        <FieldError messages={state.fieldErrors?.unit} />
        <p className="text-xs text-zinc-500">{tr("Diárias, ISS e estacionamento são lançados pelo sistema. Frigobar e restaurante têm telas próprias.")}</p>
        <FormMessage error={state.fieldErrors ? undefined : state.error} />
        <button className="btn-primary" disabled={pending}>{tr("Lançar cobrança")}</button>
      </form>
    </Frame>
  );
}

function RefundForm({ reservationId, credit, onClose, onDone }: FormProps & { reservationId: string; credit: number }) {
  const tr = useT();
  const [method, setMethod] = useState<Method>("DINHEIRO");
  const [amount, setAmount] = useState(centsToInput(credit));
  const [reason, setReason] = useState("Troco / pagamento a mais");
  const { pending, state, submit } = useSubmit();
  return (
    <Frame title={tr("Devolver crédito ({0})", [formatBRL(credit)])} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => refundAction(reservationId, { method, amount, reason }), "Devolução registrada.", onDone);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="text-xs text-zinc-500">{tr("Devolver em")}</span>
            <select className="field" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{tr(METHOD[m].label)}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Valor")}</span>
            <input className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <FieldError messages={state.fieldErrors?.amount} />
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("Motivo")}</span>
            <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            <FieldError messages={state.fieldErrors?.reason} />
          </label>
        </div>
        <FormMessage error={state.fieldErrors ? undefined : state.error} />
        <button className="btn-primary" disabled={pending}>{tr("Registrar devolução")}</button>
      </form>
    </Frame>
  );
}

function ReverseForm({ entry, onClose, onDone }: FormProps & { entry: FolioEntryView }) {
  const tr = useT();
  const [reason, setReason] = useState("");
  const { pending, state, submit } = useSubmit();
  return (
    <Frame title={tr("Estornar lançamento")} onClose={onClose}>
      <p className="mb-2 text-sm">
        <b>{entry.description}</b>{" "}{tr("— {0} ({1} de {2})", [formatBRL(entry.amountCents), entry.kind === "COBRANCA" ? tr("cobrança") : tr("pagamento"), formatDate(entry.businessDate)])}</p>
      <p className="mb-3 text-xs text-zinc-500">{tr("O lançamento não é apagado: fica riscado e um estorno com valor negativo entra na conta, com o seu nome e o motivo.")}</p>
      <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("Motivo (ex.: diária lançada em duplicidade)")} maxLength={300} autoFocus />
      <FormMessage error={state.error} />
      <button
        className="btn mt-3 bg-red-600 text-white hover:bg-red-700"
        disabled={pending || reason.trim().length < 5}
        onClick={() => submit(() => reverseAction(entry.id, reason), "Lançamento estornado.", onDone)}
      >{tr("Confirmar estorno")}</button>
    </Frame>
  );
}
