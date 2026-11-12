"use client";

import { useT } from "@/components/i18n";

// Versão de teste: lista as contas para o testador escolher um cargo.
export function DemoAccounts({ accounts, password }: { accounts: { username: string; hint: string }[]; password: string }) {
  const tr = useT();
  const fill = (u: string) => {
    const user = document.querySelector<HTMLInputElement>('input[name="username"]');
    const pass = document.querySelector<HTMLInputElement>('input[name="password"]');
    const set = (el: HTMLInputElement | null, v: string) => {
      if (!el) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set(user, u);
    set(pass, password);
  };
  return (
    <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="font-semibold text-amber-900">{tr("🧪 Versão de teste — escolha um cargo para entrar")}</div>
      <p className="mb-2 text-xs text-amber-800">{tr("Senha de todas as contas: {0}. Os dados são fictícios.", [password])}</p>
      <div className="grid grid-cols-1 gap-1">
        {accounts.map((a) => (
          <button key={a.username} type="button" onClick={() => fill(a.username)} className="flex justify-between rounded-lg bg-white px-3 py-1.5 text-left hover:bg-amber-100">
            <b>{a.username}</b>
            <span className="text-xs text-zinc-500">{tr(a.hint)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
