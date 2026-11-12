import type { Db } from "@/lib/db-types";
import type { Role } from "@/lib/permissions";
import { formatDate, type DateStr } from "@/lib/dates";

// ================================================================
// MOTOR DE RELATÓRIOS
// ================================================================
//
// Cada relatório diz: título, quem pode ver, que filtro de data usa e
// como buscar as linhas. A tela, a impressão e o arquivo para Excel são
// iguais para todos.

export type CellValue = string | number | null;

export type Column = {
  key: string;
  label: string;
  // money = centavos; int = número inteiro; date = "AAAA-MM-DD"; datetime = ISO
  type?: "text" | "money" | "int" | "date" | "datetime" | "percent";
  total?: boolean; // somar no rodapé
};

export type ReportResult = {
  columns: Column[];
  rows: Record<string, CellValue>[];
  summary?: { label: string; value: string }[];
  note?: string;
};

export type ReportParams = { from: DateStr; to: DateStr; today: DateStr; filter?: string };

export type ReportDef = {
  slug: string;
  title: string;
  description: string;
  group: "Recepção" | "Financeiro" | "Governança e manutenção" | "Restaurante e frigobar" | "Gestão";
  roles: Role[];
  // none = sem datas (ex.: hóspedes na casa); day = um dia; range = período
  period: "none" | "day" | "range";
  defaultPeriod?: "today" | "tomorrow" | "last7" | "month";
  filter?: { label: string; options: { value: string; label: string }[] };
  run: (db: Db, p: ReportParams) => Promise<ReportResult>;
};

// ----------------------------------------------------------------
// Formatação (tela e arquivo)
// ----------------------------------------------------------------

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCell(value: CellValue, type: Column["type"] = "text"): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (type) {
    case "money":
      return BRL.format(Number(value) / 100);
    case "int":
      return Number(value).toLocaleString("pt-BR");
    case "percent":
      return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "date":
      return formatDate(String(value), true);
    case "datetime":
      return new Date(String(value)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    default:
      return String(value);
  }
}

export function totals(result: ReportResult): Record<string, number> | null {
  const cols = result.columns.filter((c) => c.total);
  if (!cols.length || !result.rows.length) return null;
  return Object.fromEntries(cols.map((c) => [c.key, result.rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0)]));
}

// Arquivo CSV no padrão do Excel brasileiro: separador ";", vírgula
// decimal e BOM para os acentos abrirem certo.
export function toCsv(result: ReportResult): string {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cell = (v: CellValue, type: Column["type"]) => {
    if (v === null || v === undefined) return "";
    if (type === "money") return (Number(v) / 100).toFixed(2).replace(".", ",");
    if (type === "percent") return String(v).replace(".", ",");
    if (type === "date") return formatDate(String(v), true);
    if (type === "datetime") return formatCell(v, "datetime");
    return String(v);
  };
  const lines = [result.columns.map((c) => esc(c.label)).join(";")];
  for (const r of result.rows) lines.push(result.columns.map((c) => esc(cell(r[c.key], c.type))).join(";"));
  const t = totals(result);
  if (t) lines.push(result.columns.map((c, i) => (i === 0 ? "TOTAL" : c.key in t ? esc(cell(t[c.key], c.type)) : "")).join(";"));
  return "﻿" + lines.join("\r\n");
}

// ----------------------------------------------------------------
// Datas
// ----------------------------------------------------------------

// Início do dia "AAAA-MM-DD" no fuso do servidor (para campos com hora).
export function localStart(s: DateStr): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function localDayStr(d: Date): DateStr {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
