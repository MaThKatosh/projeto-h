"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormMessage } from "@/components/field-error";
import { PRIORITY, type TicketPriority } from "@/lib/maintenance/rules";
import { createTicketAction, type CreateTicketState } from "./actions";

import { useT } from "@/components/i18n";
const PRIORITIES: TicketPriority[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];

// Formulário de "avisar um problema". Usado no painel da manutenção (com
// lista de quartos) e no mapa (quarto já escolhido).
export function NewTicketForm({
  rooms,
  fixedRoom,
  defaultRoomId,
  onDone,
}: {
  rooms?: { id: string; number: string }[];
  fixedRoom?: { id: string; number: string };
  defaultRoomId?: string;
  onDone?: () => void;
}) {
  const tr = useT();
  const [state, action, pending] = useActionState<CreateTicketState, FormData>(createTicketAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      if (onDone) {
        const t = setTimeout(onDone, 1200);
        return () => clearTimeout(t);
      }
    }
  }, [state, onDone]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      {fixedRoom ? (
        <input type="hidden" name="roomId" value={fixedRoom.id} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-xs text-zinc-500">{tr("Quarto")}</span>
            <select name="roomId" className="field" defaultValue={defaultRoomId ?? ""}>
              <option value="">{tr("Não é num quarto")}</option>
              {rooms?.map((r) => (
                <option key={r.id} value={r.id}>{tr("Quarto")}{" "}{r.number}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-zinc-500">{tr("…ou local")}</span>
            <input name="location" className="field" placeholder={tr("Ex.: piscina, recepção")} maxLength={60} />
            <FieldError messages={state?.fieldErrors?.location} />
          </label>
        </div>
      )}
      <label className="block">
        <span className="text-xs text-zinc-500">{tr("O que aconteceu? (curto)")}</span>
        <input name="title" className="field" placeholder={tr("Ex.: chuveiro sem água quente")} maxLength={80} required />
        <FieldError messages={state?.fieldErrors?.title} />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-500">{tr("Detalhes (opcional)")}</span>
        <textarea name="description" className="field" rows={2} maxLength={1000} />
      </label>
      <fieldset>
        <legend className="mb-1 text-xs text-zinc-500">{tr("Prioridade")}</legend>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white">
              <input type="radio" name="priority" value={p} defaultChecked={p === "MEDIA"} className="sr-only" />
              <span className={`h-2.5 w-2.5 rounded-full ${PRIORITY[p].chip.split(" ")[0]}`} />
              {tr(PRIORITY[p].label)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm">
        <input type="checkbox" name="outOfOrder" className="mt-0.5" />
        <span>
          <b>{tr("Tirar o quarto de venda")}</b>{" "}{tr("até resolver")}<span className="block text-xs text-zinc-600">{tr("Use quando o hóspede não pode ficar no quarto (ex.: vazamento, sem luz).")}</span>
          <FieldError messages={state?.fieldErrors?.outOfOrder} />
        </span>
      </label>
      <FormMessage error={state?.fieldErrors ? undefined : state?.error} success={state?.success} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? tr("Enviando...") : tr("Avisar a manutenção")}
      </button>
    </form>
  );
}
