"use client";

import { useEffect, useState } from "react";

// Relógio que anda sozinho (para "há 5 min" se atualizar na tela).
export function useNow(initial: number, everyMs = 30_000) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
