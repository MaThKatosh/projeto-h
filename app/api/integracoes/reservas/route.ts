import { getDb } from "@/lib/db";
import { publish } from "@/lib/realtime";
import { applyApiReservation, checkToken } from "@/lib/integrations/service";

// Channel manager → hotel: cria, altera ou cancela uma reserva.
// Autenticação: cabeçalho "Authorization: Bearer <chave>" gerada em
// Configurações → Portais e channel manager. Formato em docs/FASE-7.md.
export async function POST(request: Request) {
  const db = getDb();
  if (!(await checkToken(db, request.headers.get("authorization")))) {
    return Response.json({ ok: false, error: "Chave de integração inválida." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  try {
    const result = await db.$transaction((tx) => applyApiReservation(tx, body));
    if (result.ok && result.action !== "ignorar") await publish({ type: "reservations.changed" });
    const { status, ...payload } = result;
    return Response.json(payload, { status });
  } catch (error) {
    console.error("[integracoes] falha ao gravar reserva", error);
    return Response.json({ ok: false, error: "Erro interno. Tente de novo." }, { status: 500 });
  }
}
