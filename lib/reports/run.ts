import "server-only";

import type { Db } from "@/lib/db-types";
import type { Role } from "@/lib/permissions";
import { addDays, isDateStr, nightsBetween } from "@/lib/dates";
import { getBusinessDate } from "@/lib/hotel-date";
import { defaultRange, findReport } from "@/lib/reports/catalog";
import type { FilterOption, ReportDef, ReportResult } from "@/lib/reports/engine";

// Lê os filtros da URL, aplica os limites e roda o relatório. Usado pela
// tela e pelo download (mesmo resultado nos dois).
export async function runReport(
  db: Db,
  role: Role,
  slug: string,
  query: { de?: string; ate?: string; filtro?: string } & Record<string, string | undefined>,
  now = new Date()
): Promise<{
  def: ReportDef;
  from: string;
  to: string;
  filter?: string;
  extra: Record<string, string>;
  extraOptions: { key: string; label: string; options: FilterOption[] }[];
  today: string;
  result: ReportResult;
  generatedAt: string;
} | null> {
  const def = findReport(slug);
  if (!def || !def.roles.includes(role)) return null;

  const today = await getBusinessDate(db);
  const d = defaultRange(def, today);
  let from = isDateStr(query.de) ? query.de : d.from;
  let to = def.period === "day" ? from : isDateStr(query.ate) ? query.ate : d.to;
  if (to < from) [from, to] = [to, from];
  // Limite de 1 ano por consulta (para não travar o sistema).
  if (nightsBetween(from, to) > 366) from = addDays(to, -366);

  const filter = def.filter?.options.some((o) => o.value === query.filtro) ? query.filtro : undefined;
  // Filtros extras: só valores que existem na lista de opções.
  const extraOptions = await Promise.all((def.extraFilters ?? []).map(async (f) => ({ key: f.key, label: f.label, options: await f.options(db) })));
  const extra: Record<string, string> = {};
  for (const f of extraOptions) {
    const v = query[f.key];
    if (v && f.options.some((o) => o.value === v)) extra[f.key] = v;
  }
  const result = await def.run(db, { from, to, today, filter, extra });
  return { def, from, to, filter, extra, extraOptions, today, result, generatedAt: now.toISOString() };
}
