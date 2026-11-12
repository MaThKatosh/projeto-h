"use client";

import { useActionState } from "react";
import { FieldError, FormMessage } from "@/components/field-error";
import { changePasswordAction, type PasswordState } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, undefined);

  return (
    <form action={action} className="space-y-3" key={state?.success ? "ok" : "form"}>
      <label className="block">
        <span className="text-xs text-zinc-500">Senha atual</span>
        <input name="currentPassword" type="password" className="field" autoComplete="current-password" required />
        <FieldError messages={state?.fieldErrors?.currentPassword} />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-500">Nova senha (mín. 8 caracteres)</span>
        <input name="newPassword" type="password" className="field" autoComplete="new-password" required />
        <FieldError messages={state?.fieldErrors?.newPassword} />
      </label>
      <FormMessage error={state?.fieldErrors ? undefined : state?.error} success={state?.success} />
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Salvando..." : "Trocar senha"}
      </button>
    </form>
  );
}
