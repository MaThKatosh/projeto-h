import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { validateSessionToken } from "@/lib/auth/service";
import { subscribe, type HotelEvent } from "@/lib/realtime";

// ================================================================
// CANAL DE AVISOS EM TEMPO REAL (Server-Sent Events)
// ================================================================
//
// Cada tela aberta mantém esta conexão. O navegador reconecta sozinho
// se ela cair. A cada 25 s mandamos um "ping" (evita que proxies fechem
// a conexão) e revalidamos a sessão: usuário desativado para de receber.

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i !== -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export async function GET(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  const db = getDb();
  if (!(await validateSessionToken(db, token))) {
    return Response.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          close();
        }
      };

      const unsubscribe = await subscribe((event: HotelEvent) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      const heartbeat = setInterval(async () => {
        send(`: ping\n\n`);
        if (!(await validateSessionToken(db, token))) close();
      }, 25_000);

      function close() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // já fechado
        }
      }
      cleanup = close;

      request.signal.addEventListener("abort", close);
      send(`retry: 3000\nevent: ready\ndata: {}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
