"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/field-error";
import { loginAction, type LoginState } from "./actions";

import { useT } from "@/components/i18n";
export function LoginForm() {
  const tr = useT();
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{tr("Usuário")}</span>
        <input
          name="username"
          className="field"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          defaultValue={state?.username}
          required
        />
        <FieldError messages={state?.fieldErrors?.username} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{tr("Senha")}</span>
        <input name="password" type="password" className="field" autoComplete="current-password" required />
        <FieldError messages={state?.fieldErrors?.password} />
      </label>
      {state?.error && !state.fieldErrors && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {tr(state.error)}
        </p>
      )}
      <button type="submit" className="btn-primary w-full py-3" disabled={pending}>
        {pending ? tr("Entrando...") : tr("Entrar")}
      </button>
    </form>
  );
}

