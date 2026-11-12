"use client";

import { useEffect } from "react";

// Registra o service worker do app instalável (só na versão instalada no
// servidor; em desenvolvimento ele atrapalharia as recargas).
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // sem HTTPS o navegador recusa: o sistema funciona igual, só não instala
    });
  }, []);
  return null;
}
