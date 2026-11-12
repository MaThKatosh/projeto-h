"use client";

import { LiveDot, useLiveRefresh } from "@/components/live-refresh";

// Para páginas do servidor: recarrega os dados quando chega um aviso.
export function LiveRefresher({ types }: { types: string[] }) {
  const connected = useLiveRefresh(types);
  return <LiveDot connected={connected} />;
}
