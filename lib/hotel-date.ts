import type { Db } from "@/lib/db-types";
import { isDateStr, localToday, type DateStr } from "@/lib/dates";

// ================================================================
// DATA DO SISTEMA (data hoteleira)
// ================================================================
//
// É o "hoje" do hotel: chegadas de hoje, saídas de hoje, no-show...
// Não vira à meia-noite: vira na auditoria noturna (lib/night-audit).

const KEY = "businessDate";

export async function getBusinessDate(db: Db): Promise<DateStr> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (row && isDateStr(row.value)) return row.value;
  return localToday();
}
