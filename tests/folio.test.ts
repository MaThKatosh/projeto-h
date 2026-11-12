import { describe, expect, it } from "vitest";
import {
  chargeSchema,
  effectiveCheckOut,
  folioTotals,
  issFor,
  nightsToPost,
  paymentSchema,
  refundSchema,
  reverseSchema,
  vehicleOnNight,
} from "@/lib/folio/rules";

describe("saldo da conta", () => {
  it("cobranças menos pagamentos", () => {
    const t = folioTotals([
      { kind: "COBRANCA", amountCents: 21000 },
      { kind: "COBRANCA", amountCents: 1050 },
      { kind: "PAGAMENTO", amountCents: 20000 },
    ]);
    expect(t).toEqual({ charges: 22050, payments: 20000, balance: 2050 });
  });

  it("estorno (valor negativo) anula o lançamento original", () => {
    const t = folioTotals([
      { kind: "COBRANCA", amountCents: 21000 },
      { kind: "COBRANCA", amountCents: 21000 },
      { kind: "COBRANCA", amountCents: -21000 },
    ]);
    expect(t.balance).toBe(21000);
  });

  it("pagamento a mais vira crédito; devolução zera", () => {
    expect(folioTotals([{ kind: "COBRANCA", amountCents: 100 }, { kind: "PAGAMENTO", amountCents: 150 }]).balance).toBe(-50);
    expect(
      folioTotals([
        { kind: "COBRANCA", amountCents: 100 },
        { kind: "PAGAMENTO", amountCents: 150 },
        { kind: "PAGAMENTO", amountCents: -50 },
      ]).balance
    ).toBe(0);
  });
});

describe("diárias a lançar", () => {
  it("lista as noites que faltam, pulando as já lançadas", () => {
    expect(nightsToPost("2026-11-10", "2026-11-13", new Set(["2026-11-11"]))).toEqual(["2026-11-10", "2026-11-12"]);
  });

  it("nada a lançar quando o fim é antes do começo", () => {
    expect(nightsToPost("2026-11-12", "2026-11-12", new Set())).toEqual([]);
  });

  it("saída efetiva: antecipada encurta, mínimo uma noite", () => {
    expect(effectiveCheckOut("2026-11-10", "2026-11-15", "2026-11-12")).toBe("2026-11-12");
    expect(effectiveCheckOut("2026-11-12", "2026-11-15", "2026-11-12")).toBe("2026-11-13");
    expect(effectiveCheckOut("2026-11-10", "2026-11-12", "2026-11-14")).toBe("2026-11-12");
  });

  it("ISS sobre a diária, arredondado em centavos", () => {
    expect(issFor(21000, true, 500)).toBe(1050);
    expect(issFor(19999, true, 500)).toBe(1000);
    expect(issFor(21000, false, 500)).toBe(0);
  });

  it("veículo conta na noite em que estava na garagem", () => {
    expect(vehicleOnNight("2026-11-12", null, "2026-11-12")).toBe(true);
    expect(vehicleOnNight("2026-11-12", "2026-11-12", "2026-11-12")).toBe(false);
    expect(vehicleOnNight("2026-11-13", null, "2026-11-12")).toBe(false);
  });
});

describe("formulários da conta", () => {
  it("cobrança manual: diária não pode ser lançada à mão", () => {
    expect(chargeSchema.safeParse({ category: "DIARIA", description: "x", quantity: 1, unit: "10" }).success).toBe(false);
    const ok = chargeSchema.safeParse({ category: "LAVANDERIA", description: "2 camisas", quantity: 2, unit: "15,00" });
    expect(ok.success && ok.data.unit).toBe(1500);
  });

  it("pagamento precisa de valor positivo", () => {
    expect(paymentSchema.safeParse({ method: "PIX", amount: "0" }).success).toBe(false);
    expect(paymentSchema.safeParse({ method: "PIX", amount: "220,50" }).success).toBe(true);
  });

  it("estorno e devolução exigem motivo", () => {
    expect(reverseSchema.safeParse("erro").success).toBe(false);
    expect(reverseSchema.safeParse("diária em duplicidade").success).toBe(true);
    expect(refundSchema.safeParse({ method: "DINHEIRO", amount: "10", reason: "" }).success).toBe(false);
  });
});
