import { describe, expect, it } from "vitest";
import { formatCell, toCsv, totals, type ReportResult } from "@/lib/reports/engine";
import { defaultRange, REPORTS } from "@/lib/reports/catalog";
import { can } from "@/lib/permissions";

const sample: ReportResult = {
  columns: [
    { key: "nome", label: "Hóspede" },
    { key: "pessoas", label: "Pessoas", type: "int", total: true },
    { key: "valor", label: "Valor", type: "money", total: true },
  ],
  rows: [
    { nome: "Ana; Silva", pessoas: 2, valor: 22050 },
    { nome: "João", pessoas: 1, valor: -1000 },
  ],
};

describe("motor de relatórios", () => {
  it("soma as colunas marcadas", () => {
    expect(totals(sample)).toEqual({ pessoas: 3, valor: 21050 });
  });

  it("formata dinheiro, datas e vazios", () => {
    expect(formatCell(22050, "money").replace(/\s/g, " ")).toBe("R$ 220,50");
    expect(formatCell("2026-11-12", "date")).toBe("12/11/2026");
    expect(formatCell(null)).toBe("—");
    expect(formatCell(32.5, "percent")).toBe("32,5%");
  });

  it("gera CSV para o Excel brasileiro (;, vírgula decimal, acentos, total)", () => {
    const csv = toCsv(sample);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Hóspede;Pessoas;Valor");
    expect(lines[1]).toBe('"Ana; Silva";2;220,50');
    expect(lines[2]).toBe("João;1;-10,00");
    expect(lines[3]).toBe("TOTAL;3;210,50");
  });
});

describe("catálogo", () => {
  it("cada relatório tem endereço único", () => {
    const slugs = REPORTS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("tem os relatórios pedidos", () => {
    const slugs = REPORTS.map((r) => r.slug);
    for (const s of ["bordero", "mudancas-de-quarto", "check-ins", "check-outs", "hospedes-na-casa", "cafe-da-manha", "registro-de-acoes"]) {
      expect(slugs).toContain(s);
    }
  });

  it("períodos padrão", () => {
    const cafe = REPORTS.find((r) => r.slug === "cafe-da-manha")!;
    expect(defaultRange(cafe, "2026-11-30")).toEqual({ from: "2026-12-01", to: "2026-12-01" });
    const mes = REPORTS.find((r) => r.slug === "estornos")!;
    expect(defaultRange(mes, "2026-11-12")).toEqual({ from: "2026-11-01", to: "2026-11-12" });
  });

  it("estornos e registro de ações só para a chefia", () => {
    for (const s of ["estornos", "registro-de-acoes", "ocupacao"]) {
      expect(REPORTS.find((r) => r.slug === s)!.roles).not.toContain("RECEPCAO");
    }
  });

  it("recepcionista da noite pode rodar a auditoria; camareira não", () => {
    expect(can("RECEPCAO", "audit.run")).toBe(true);
    expect(can("GOVERNANCA", "audit.run")).toBe(false);
  });
});
