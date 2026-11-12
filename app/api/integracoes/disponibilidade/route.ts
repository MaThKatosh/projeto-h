import { getDb } from "@/lib/db";
import { addDays, isDateStr, nightsBetween } from "@/lib/dates";
import { getBusinessDate } from "@/lib/hotel-date";
import { availabilityForApi, checkToken } from "@/lib/integrations/service";

// Hotel → channel manager: quartos livres por tipo e noite.
// GET /api/integracoes/disponibilidade?de=2026-12-01&ate=2026-12-31
export async function GET(request: Request) {
  const db = getDb();
  if (!(await checkToken(db, request.headers.get("authorization")))) {
    return Response.json({ ok: false, error: "Chave de integração inválida." }, { status: 401 });
  }
  const url = new URL(request.url);
  const today = await getBusinessDate(db);
  const from = url.searchParams.get("de") ?? today;
  const to = url.searchParams.get("ate") ?? addDays(from, 30);
  if (!isDateStr(from) || !isDateStr(to) || to <= from || nightsBetween(from, to) > 366) {
    return Response.json({ ok: false, error: "Use de/ate no formato AAAA-MM-DD, até 366 noites." }, { status: 400 });
  }
  return Response.json({ ok: true, from, to, roomTypes: await availabilityForApi(db, from, to) });
}
