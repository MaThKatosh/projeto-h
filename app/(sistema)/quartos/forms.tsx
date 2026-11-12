"use client";

import { useActionState } from "react";
import { FieldError, FormMessage } from "@/components/field-error";
import type { RoomView } from "@/lib/rooms/service";
import {
  createRoomRangeAction,
  createRoomTypeAction,
  updateRoomAction,
  updateRoomTypeAction,
  type FormState,
} from "./actions";

type TypeOption = { id: string; name: string };

export function RoomTypeForm({
  type,
  roomCount,
}: {
  type?: { id: string; name: string; capacity: number; description: string };
  roomCount?: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    type ? updateRoomTypeAction : createRoomTypeAction,
    undefined
  );

  return (
    <form
      action={action}
      className={`grid gap-2 rounded-lg p-3 sm:grid-cols-[2fr_6rem_3fr_auto] sm:items-start ${type ? "bg-zinc-50" : "border border-dashed border-zinc-300"}`}
    >
      {type && <input type="hidden" name="id" value={type.id} />}
      <label>
        <span className="text-xs text-zinc-500">Nome {roomCount !== undefined && `(${roomCount} quartos)`}</span>
        <input name="name" className="field" defaultValue={type?.name} placeholder="Novo tipo" required />
        <FieldError messages={state?.fieldErrors?.name} />
      </label>
      <label>
        <span className="text-xs text-zinc-500">Pessoas</span>
        <input name="capacity" type="number" min={1} max={20} className="field" defaultValue={type?.capacity ?? 2} required />
        <FieldError messages={state?.fieldErrors?.capacity} />
      </label>
      <label>
        <span className="text-xs text-zinc-500">Descrição (opcional)</span>
        <input name="description" className="field" defaultValue={type?.description} maxLength={200} />
      </label>
      <div className="sm:pt-4">
        <button type="submit" className={type ? "btn-secondary w-full" : "btn-primary w-full"} disabled={pending}>
          {type ? "Salvar" : "+ Criar tipo"}
        </button>
      </div>
      <div className="sm:col-span-4">
        <FormMessage error={state?.fieldErrors ? undefined : state?.error} success={state?.success} />
      </div>
    </form>
  );
}

export function RoomRangeForm({ types }: { types: TypeOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createRoomRangeAction, undefined);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          <span className="text-xs text-zinc-500">Andar</span>
          <input name="floor" type="number" className="field" defaultValue={1} required />
          <FieldError messages={state?.fieldErrors?.floor} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">Do número</span>
          <input name="from" type="number" min={1} className="field" placeholder="101" required />
          <FieldError messages={state?.fieldErrors?.from} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">Até o número</span>
          <input name="to" type="number" min={1} className="field" placeholder="110" required />
          <FieldError messages={state?.fieldErrors?.to} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">Tipo</span>
          <select name="roomTypeId" className="field" required>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <FieldError messages={state?.fieldErrors?.roomTypeId} />
        </label>
      </div>
      <FormMessage error={state?.fieldErrors ? undefined : state?.error} success={state?.success} />
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Criando..." : "Criar quartos"}
      </button>
    </form>
  );
}

export function RoomRow({ room, types }: { room: RoomView; types: TypeOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateRoomAction, undefined);
  const typeId = types.find((t) => t.name === room.typeName)?.id;

  return (
    <form action={action} className={`rounded-lg p-3 ${room.active ? "bg-zinc-50" : "bg-zinc-100 opacity-70"}`}>
      <input type="hidden" name="id" value={room.id} />
      <div className="grid items-end gap-2 sm:grid-cols-[6rem_5rem_1fr_auto_auto]">
        <label>
          <span className="text-xs text-zinc-500">Número</span>
          <input name="number" className="field" defaultValue={room.number} required />
        </label>
        <label>
          <span className="text-xs text-zinc-500">Andar</span>
          <input name="floor" type="number" className="field" defaultValue={room.floor} required />
        </label>
        <label>
          <span className="text-xs text-zinc-500">Tipo</span>
          <select name="roomTypeId" className="field" defaultValue={typeId}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={room.active} /> Ativo
        </label>
        <button type="submit" className="btn-secondary" disabled={pending}>Salvar</button>
      </div>
      <div className="mt-1">
        <FieldError messages={state?.fieldErrors?.number ?? state?.fieldErrors?.floor} />
        {state?.error && !state.fieldErrors && <span className="text-xs text-red-600">{state.error}</span>}
        {state?.success && <span className="text-xs text-emerald-700">✓ {state.success}</span>}
      </div>
    </form>
  );
}
