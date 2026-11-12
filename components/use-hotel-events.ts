"use client";

import { useEffect, useRef, useState } from "react";

// Mesmos tipos de HotelEvent (lib/realtime.ts).
export const HOTEL_EVENT_TYPES = ["room.updated", "rooms.changed", "housekeeping.changed", "maintenance.changed", "reservations.changed", "restaurant.changed", "requests.changed"] as const;

// Escuta os avisos em tempo real do servidor (/api/eventos).
// `connected` mostra na tela se a ligação está ativa. Quando a conexão
// volta depois de cair, chama onReconnect para a tela se atualizar.

export function useHotelEvents(
  handlers: Record<string, (data: unknown) => void>,
  onReconnect?: () => void
) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  const reconnectRef = useRef(onReconnect);

  useEffect(() => {
    handlersRef.current = handlers;
    reconnectRef.current = onReconnect;
  });

  useEffect(() => {
    let source: EventSource | null = null;
    let wasDown = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const open = () => {
      source = new EventSource("/api/eventos");
      source.addEventListener("ready", () => {
        setConnected(true);
        if (wasDown) reconnectRef.current?.();
        wasDown = false;
      });
      for (const type of HOTEL_EVENT_TYPES) {
        source.addEventListener(type, (e) => {
          try {
            handlersRef.current[type]?.(JSON.parse((e as MessageEvent).data));
          } catch {
            // ignora aviso malformado
          }
        });
      }
      source.onerror = () => {
        setConnected(false);
        wasDown = true;
        // Sessão expirada (401) faz o navegador desistir: tentamos de novo
        // e, se o problema for a sessão, a próxima navegação leva ao login.
        if (source?.readyState === EventSource.CLOSED && !stopped) {
          retry = setTimeout(open, 5000);
        }
      };
    };

    open();
    return () => {
      stopped = true;
      clearTimeout(retry);
      source?.close();
    };
  }, []);

  return connected;
}
