// ================================================================
// DATAS DE ESTADIA ("AAAA-MM-DD")
// ================================================================
//
// Estadias usam só a DATA (sem hora). Trabalhamos com texto
// "AAAA-MM-DD" para não sofrer com fuso horário. No banco (@db.Date) a
// data volta como meia-noite UTC; toDateStr/fromDateStr convertem.

export type DateStr = string;

const RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateStr(value: unknown): value is DateStr {
  if (typeof value !== "string" || !RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

export function toDateStr(d: Date): DateStr {
  return d.toISOString().slice(0, 10);
}

export function fromDateStr(s: DateStr): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function addDays(s: DateStr, days: number): DateStr {
  const d = fromDateStr(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

export function nightsBetween(from: DateStr, to: DateStr): number {
  return Math.round((fromDateStr(to).getTime() - fromDateStr(from).getTime()) / 86_400_000);
}

// Data local do computador (para o valor inicial da data do sistema).
export function localToday(now = new Date()): DateStr {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function weekday(s: DateStr): string {
  return WEEKDAYS[fromDateStr(s).getUTCDay()];
}

// "12/11" ou "12/11/2026"
export function formatDate(s: DateStr, withYear = false): string {
  const [y, m, d] = s.split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

export function isWeekend(s: DateStr): boolean {
  const day = fromDateStr(s).getUTCDay();
  return day === 0 || day === 6;
}
