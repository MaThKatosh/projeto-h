import { describe, expect, it } from "vitest";
import { paramsFor, ruleApplies, ruleSchema, suggestPrice, type Rule } from "@/lib/revenue/rules";

const rule = (r: Partial<Rule>): Rule => ({ id: "x", name: "r", kind: "DIA_SEMANA", params: {}, adjustBp: 1000, roomTypeId: null, active: true, ...r });
const ctx = { date: "2026-11-14", today: "2026-11-12", occupancyPct: 50, roomTypeId: "A" }; // 14/11/2026 = sábado

describe("revenue: quando cada regra vale", () => {
  it("dia da semana", () => {
    expect(ruleApplies(rule({ params: { days: [5, 6] } }), ctx)).toBe(true);
    expect(ruleApplies(rule({ params: { days: [1] } }), ctx)).toBe(false);
  });
  it("ocupação", () => {
    expect(ruleApplies(rule({ kind: "OCUPACAO", params: { minOccupancy: 50 } }), ctx)).toBe(true);
    expect(ruleApplies(rule({ kind: "OCUPACAO", params: { minOccupancy: 70 } }), ctx)).toBe(false);
  });
  it("período (inclui as pontas)", () => {
    expect(ruleApplies(rule({ kind: "PERIODO", params: { from: "2026-11-14", to: "2026-11-15" } }), ctx)).toBe(true);
    expect(ruleApplies(rule({ kind: "PERIODO", params: { from: "2026-12-30", to: "2027-01-02" } }), ctx)).toBe(false);
  });
  it("última hora", () => {
    expect(ruleApplies(rule({ kind: "ANTECEDENCIA", params: { maxDaysAhead: 2 } }), ctx)).toBe(true);
    expect(ruleApplies(rule({ kind: "ANTECEDENCIA", params: { maxDaysAhead: 1 } }), ctx)).toBe(false);
  });
  it("tipo de quarto e regra desligada", () => {
    expect(ruleApplies(rule({ params: { days: [6] }, roomTypeId: "B" }), ctx)).toBe(false);
    expect(ruleApplies(rule({ params: { days: [6] }, active: false }), ctx)).toBe(false);
  });
});

describe("revenue: preço sugerido", () => {
  it("soma os ajustes e arredonda para R$ 1", () => {
    const rules = [rule({ name: "Sábado", params: { days: [6] }, adjustBp: 1000 }), rule({ name: "Lotando", kind: "OCUPACAO", params: { minOccupancy: 40 }, adjustBp: 1500 })];
    const s = suggestPrice(21000, rules, ctx);
    expect(s.adjustBp).toBe(2500);
    expect(s.price).toBe(26300); // 210 × 1,25 = 262,50 → 263
    expect(s.applied.map((a) => a.name)).toEqual(["Sábado", "Lotando"]);
  });
  it("sem regra = preço base; trava em -50%", () => {
    expect(suggestPrice(21000, [], ctx).price).toBe(21000);
    expect(suggestPrice(20000, [rule({ params: { days: [6] }, adjustBp: -4000 }), rule({ kind: "ANTECEDENCIA", params: { maxDaysAhead: 5 }, adjustBp: -4000 })], ctx).price).toBe(10000);
  });
});

describe("revenue: formulário da regra", () => {
  it("valida conforme o tipo", () => {
    expect(ruleSchema.safeParse({ name: "Fim de semana", kind: "DIA_SEMANA", adjustPercent: 10, days: [] }).success).toBe(false);
    expect(ruleSchema.safeParse({ name: "Réveillon", kind: "PERIODO", adjustPercent: 40, from: "2027-01-02", to: "2026-12-30" }).success).toBe(false);
    expect(ruleSchema.safeParse({ name: "Zero", kind: "DIA_SEMANA", adjustPercent: 0, days: [1] }).success).toBe(false);
    const ok = ruleSchema.parse({ name: "Fim de semana", kind: "DIA_SEMANA", adjustPercent: "10", days: [6, 5, 6] });
    expect(paramsFor(ok)).toEqual({ days: [5, 6] });
  });
});
