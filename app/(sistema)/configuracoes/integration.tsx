"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import type { TokenInfo } from "@/lib/integrations/service";
import { revokeTokenAction, rotateTokenAction } from "./actions";

// Portais: importação por arquivo + chave para o channel manager.
export function IntegrationSection({ info, origin }: { info: TokenInfo; origin: string }) {
  const tr = useT();
  const [token, setToken] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">{tr("🌐 Portais e channel manager")}</h2>
      <p className="text-sm">
        <b>{tr("Por arquivo:")}</b>{" "}{tr("baixe as reservas do Booking.com, Expedia / Hoteis.com etc. e importe em")}{" "}
        <Link href="/reservas/importar" className="text-blue-700 underline">{tr("Reservas → Importar do portal")}</Link>.
      </p>
      <div className="text-sm">
        <b>{tr("Automático (channel manager):")}</b>{" "}
        {tr("ao contratar um channel manager, passe a ele o endereço e a chave abaixo. As reservas entram sozinhas e ele consulta as vagas do hotel.")}
      </div>
      <dl className="grid gap-1 rounded-lg bg-zinc-50 p-3 text-xs sm:grid-cols-[auto_1fr]">
        <dt className="text-zinc-500">{tr("Enviar reservas (POST)")}</dt>
        <dd className="font-mono break-all">{origin}/api/integracoes/reservas</dd>
        <dt className="text-zinc-500">{tr("Consultar vagas (GET)")}</dt>
        <dd className="font-mono break-all">{origin}/api/integracoes/disponibilidade?de=AAAA-MM-DD&amp;ate=AAAA-MM-DD</dd>
        <dt className="text-zinc-500">{tr("Chave")}</dt>
        <dd>{info ? tr("ativa, termina em …{0} (criada em {1})", [info.last4, new Date(info.createdAt).toLocaleDateString("pt-BR")]) : tr("nenhuma — a integração está desligada")}</dd>
      </dl>
      {token && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <div className="font-semibold">{tr("Copie agora: a chave não aparece de novo.")}</div>
          <code className="mt-1 block font-mono text-xs break-all select-all">{token}</code>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => {
            if (info && !confirm(tr("Gerar uma chave nova? A atual para de funcionar na hora."))) return;
            start(async () => setToken(await rotateTokenAction()));
          }}
        >
          {info ? tr("Gerar chave nova") : tr("Ligar integração (gerar chave)")}
        </button>
        {info && (
          <button
            type="button"
            className="btn-secondary text-red-700"
            disabled={pending}
            onClick={() => {
              if (!confirm(tr("Desligar a integração? O channel manager deixa de enviar reservas."))) return;
              start(async () => {
                await revokeTokenAction();
                setToken(null);
              });
            }}
          >
            {tr("Desligar")}
          </button>
        )}
      </div>
    </section>
  );
}
