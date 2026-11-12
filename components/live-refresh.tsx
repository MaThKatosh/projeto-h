"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useHotelEvents } from "@/components/use-hotel-events";

import { useT } from "@/components/i18n";
// Para painéis que mostram dados do servidor: qualquer aviso relevante
// recarrega a tela (sem perder o que está aberto). Vários avisos juntos
// viram uma recarga só.
export function useLiveRefresh(types: string[]) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 250);
  };

  return useHotelEvents(Object.fromEntries(types.map((t) => [t, refresh])), refresh);
}

export function LiveDot({ connected }: { connected: boolean }) {
  const tr = useT();
  return (
    <span className="flex items-center gap-2 text-sm text-zinc-500">
      <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "animate-pulse bg-red-500"}`} />
      {connected ? tr("Ao vivo") : tr("Reconectando...")}
    </span>
  );
}
