"use client";

import { useActionState, useRef, useEffect } from "react";
import { FieldError, FormMessage } from "@/components/field-error";
import { createUserAction, updateUserAction, type FormState } from "./actions";

import { useT } from "@/components/i18n";
type RoleOption = { value: string; label: string };

export function NewUserForm({ roles }: { roles: RoleOption[] }) {
  const tr = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(createUserAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className="text-xs text-zinc-500">{tr("Nome completo")}</span>
          <input name="fullName" className="field" required />
          <FieldError messages={state?.fieldErrors?.fullName} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">{tr("Usuário (para entrar)")}</span>
          <input name="username" className="field" autoCapitalize="none" placeholder={tr("ex.: maria.silva")} required />
          <FieldError messages={state?.fieldErrors?.username} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">{tr("Cargo")}</span>
          <select name="role" className="field" required defaultValue="">
            <option value="" disabled>{tr("Escolha...")}</option>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{tr(r.label)}</option>
            ))}
          </select>
          <FieldError messages={state?.fieldErrors?.role} />
        </label>
        <label>
          <span className="text-xs text-zinc-500">{tr("Senha inicial (mín. 8)")}</span>
          <input name="password" type="text" className="field" autoComplete="new-password" required />
          <FieldError messages={state?.fieldErrors?.password} />
        </label>
      </div>
      <FormMessage error={state?.fieldErrors ? undefined : state?.error} success={state?.success} />
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? tr("Criando...") : tr("+ Criar usuário")}
      </button>
    </form>
  );
}

export function UserRow({
  user,
  roleLabel,
  roles,
  editable,
  self,
}: {
  user: { id: string; username: string; fullName: string; role: string; active: boolean; lastLoginAt: string | null };
  roleLabel: string;
  roles: RoleOption[];
  editable: boolean;
  self: boolean;
}) {
  const tr = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(updateUserAction, undefined);
  const lastLogin = user.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : tr("nunca entrou");

  if (!editable) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 p-3 text-sm">
        <div>
          <b>{user.fullName}</b> <span className="text-zinc-500">@{user.username}</span>
        </div>
        <div className="text-zinc-500">{roleLabel} · {user.active ? tr("ativo") : tr("desativado")}</div>
      </div>
    );
  }

  return (
    <form action={action} className={`rounded-lg p-3 ${user.active ? "bg-zinc-50" : "bg-zinc-100 opacity-70"}`}>
      <input type="hidden" name="id" value={user.id} />
      <div className="mb-2 text-xs text-zinc-500">
        @{user.username} {self && <b className="text-blue-700">{tr("(você)")}</b>}{" "}{tr("· último acesso: {0}", [lastLogin])}</div>
      <div className="grid items-end gap-2 sm:grid-cols-[2fr_1.3fr_1.5fr_auto_auto]">
        <label>
          <span className="text-xs text-zinc-500">{tr("Nome")}</span>
          <input name="fullName" className="field" defaultValue={user.fullName} required />
        </label>
        <label>
          <span className="text-xs text-zinc-500">{tr("Cargo")}</span>
          <select name="role" className="field" defaultValue={user.role} disabled={self}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{tr(r.label)}</option>
            ))}
          </select>
          {self && <input type="hidden" name="role" value={user.role} />}
        </label>
        <label>
          <span className="text-xs text-zinc-500">{tr("Nova senha (opcional)")}</span>
          <input name="password" type="text" className="field" autoComplete="new-password" placeholder={tr("manter atual")} disabled={self} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={user.active} disabled={self} />{" "}{tr("Ativo")}{self && <input type="hidden" name="active" value="on" />}
        </label>
        <button type="submit" className="btn-secondary" disabled={pending}>{tr("Salvar")}</button>
      </div>
      <div className="mt-1 text-xs">
        <FieldError messages={state?.fieldErrors?.fullName ?? state?.fieldErrors?.password ?? state?.fieldErrors?.role} />
        {state?.error && !state.fieldErrors && <span className="text-red-600">{tr(state.error)}</span>}
        {state?.success && <span className="text-emerald-700">✓ {tr(state.success)}</span>}
      </div>
    </form>
  );
}
