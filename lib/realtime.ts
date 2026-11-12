import "server-only";

import { EventEmitter } from "node:events";
import { Client } from "pg";
import { databaseUrl, getDb } from "@/lib/db";
import type { RoomView } from "@/lib/rooms/service";

// ================================================================
// AVISOS EM TEMPO REAL
// ================================================================
//
// Quando algo muda (ex.: quarto ficou limpo), o servidor avisa o banco
// com NOTIFY. Um único "ouvinte" por servidor recebe o aviso e repassa
// para todas as telas abertas (via /api/eventos). Usar o banco como
// carteiro permite, no futuro, ter mais de um servidor.

const CHANNEL = "hotel_events";

export type HotelEvent =
  | { type: "room.updated"; room: RoomView; by: string }
  | { type: "rooms.changed" } // cadastro mudou: telas recarregam a lista
  | { type: "housekeeping.changed"; message?: string } // tarefas de limpeza
  | { type: "maintenance.changed"; message?: string } // ocorrências
  | { type: "reservations.changed" } // reservas, check-in/out, garagem, conta
  | { type: "restaurant.changed" }; // comandas, cozinha, cardápio

type Hub = { emitter: EventEmitter; ready: Promise<void> | null };

const globalForHub = globalThis as unknown as { hotelHub?: Hub };

function hub(): Hub {
  if (!globalForHub.hotelHub) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(500);
    globalForHub.hotelHub = { emitter, ready: null };
  }
  return globalForHub.hotelHub;
}

// Abre (uma vez) a conexão que fica escutando o banco. Se cair, tenta
// de novo em 3 s; as telas também se reconectam sozinhas.
function ensureListening(): Promise<void> {
  const h = hub();
  if (h.ready) return h.ready;

  h.ready = (async () => {
    const client = new Client({ connectionString: databaseUrl() });
    const restart = () => {
      h.ready = null;
      client.removeAllListeners();
      client.end().catch(() => {});
      setTimeout(() => {
        if (h.emitter.listenerCount("event") > 0) ensureListening().catch(() => {});
      }, 3000);
    };
    client.on("error", restart);
    client.on("end", restart);
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        h.emitter.emit("event", JSON.parse(msg.payload) as HotelEvent);
      } catch {
        // aviso malformado: ignora
      }
    });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
  })().catch((error) => {
    h.ready = null;
    throw error;
  });

  return h.ready;
}

export async function subscribe(listener: (event: HotelEvent) => void): Promise<() => void> {
  await ensureListening();
  const { emitter } = hub();
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}

export async function publish(event: HotelEvent): Promise<void> {
  try {
    await getDb().$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(event)})`;
  } catch (error) {
    // Aviso perdido não pode desfazer a operação: as telas se corrigem
    // na próxima reconexão/recarga.
    console.error("[realtime] falha ao publicar", error);
  }
}
