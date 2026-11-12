import { getDb } from "@/lib/db";

// Verificação de saúde (instalação e monitoramento): o sistema responde e
// o banco está acessível. Não mostra nenhum dado do hotel.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
