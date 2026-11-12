import type { Db } from "@/lib/db-types";
import { addDays, isDateStr, localToday, type DateStr } from "@/lib/dates";

// ================================================================
// DATA DO SISTEMA (data hoteleira)
// ================================================================
//
// É o "hoje" do hotel: chegadas de hoje, saídas de hoje, no-show...
// Não vira à meia-noite: vira na auditoria noturna (Fase 6). Até lá, o
// gerente avança manualmente pela recepção.

const KEY = "businessDate";

export async function getBusinessDate(db: Db): Promise<DateStr> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (row && isDateStr(row.value)) return row.value;
  return localToday();
}

// Avança um dia. Não deixa a data do sistema passar do calendário.
export async function advanceBusinessDate(db: Db): Promise<{ ok: true; date: DateStr } | { ok: false; error: string }> {
  const current = await getBusinessDate(db);
  const next = addDays(current, 1);
  if (next > localToday()) {
    return { ok: false, error: "A data do sistema já é a de hoje. Só dá para avançar depois da meia-noite." };
  }
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: next }, update: { value: next } });
  return { ok: true, date: next };
}
