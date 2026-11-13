import { getDb } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { exportGuest } from "@/lib/privacy/service";

// Arquivo com tudo o que o hotel guarda sobre o hóspede (pedido LGPD).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || !can(session.user.role, "settings.manage")) return new Response("Sem permissão.", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Não encontrado.", { status: 404 });
  const data = await exportGuest(getDb(), session.user, id);
  if (!data) return new Response("Não encontrado.", { status: 404 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dados-hospede-${id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
