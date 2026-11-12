import { getDb } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/reports/engine";
import { runReport } from "@/lib/reports/run";

// Download do relatório em CSV (abre direto no Excel).
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getCurrentSession();
  if (!session) return new Response("Sessão expirada.", { status: 401 });
  const { slug } = await params;
  const url = new URL(request.url);
  const db = getDb();
  const data = await runReport(db, session.user.role, slug, {
    de: url.searchParams.get("de") ?? undefined,
    ate: url.searchParams.get("ate") ?? undefined,
    filtro: url.searchParams.get("filtro") ?? undefined,
  });
  if (!data) return new Response("Relatório não encontrado.", { status: 404 });

  await audit(db, "report.download", { userId: session.user.id, metadata: { slug, from: data.from, to: data.to } });
  const name = data.def.period === "none" ? `${slug}.csv` : `${slug}_${data.from}_a_${data.to}.csv`;
  return new Response(toCsv(data.result), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
