import { describe, expect, it } from "vitest";
import { change, comandaTotals, menuItemSchema, minibarSchema, orderSchema, posPaymentSchema } from "@/lib/restaurant/rules";
import { can } from "@/lib/permissions";

const item = (unitCents: number, quantity: number, status: "PENDENTE" | "PRONTO" | "ENTREGUE" | "CANCELADO" = "ENTREGUE") => ({
  unitCents,
  quantity,
  status,
});

describe("total da comanda", () => {
  it("soma os itens e a taxa de serviço de 10%", () => {
    const t = comandaTotals([item(6900, 1), item(800, 2)], true, 1000);
    expect(t).toEqual({ subtotal: 8500, service: 850, total: 9350, paid: 0, remaining: 9350 });
  });

  it("item cancelado não entra no total", () => {
    expect(comandaTotals([item(6900, 1), item(3200, 1, "CANCELADO")], false, 1000).total).toBe(6900);
  });

  it("sem taxa de serviço quando desligada", () => {
    expect(comandaTotals([item(1000, 3)], false, 1000).service).toBe(0);
  });

  it("desconta o que já foi pago", () => {
    expect(comandaTotals([item(5000, 1)], false, 1000, 2000).remaining).toBe(3000);
  });
});

describe("troco", () => {
  it("devolve a diferença; nunca negativo", () => {
    expect(change(10000, 9350)).toBe(650);
    expect(change(5000, 9350)).toBe(0);
  });
});

describe("validações", () => {
  it("pedido precisa de ao menos um item", () => {
    expect(orderSchema.safeParse([]).success).toBe(false);
    expect(orderSchema.safeParse([{ menuItemId: "6f1c2a3b-1111-4222-8333-944455556666", quantity: 2 }]).success).toBe(true);
  });

  it("pagamento do restaurante em formato brasileiro", () => {
    const r = posPaymentSchema.safeParse({ method: "DINHEIRO", amount: "93,50" });
    expect(r.success && r.data.amount).toBe(9350);
  });

  it("item do cardápio não aceita preço inválido", () => {
    expect(menuItemSchema.safeParse({ outlet: "RESTAURANTE", name: "Suco", group: "Bebidas", price: "abc", kitchen: true, active: true }).success).toBe(false);
  });

  it("frigobar precisa de ao menos um item", () => {
    expect(minibarSchema.safeParse([]).success).toBe(false);
  });
});

describe("quem pode o quê no restaurante", () => {
  it("garçom usa o restaurante e a cozinha, mas não mexe no cardápio", () => {
    expect(can("RESTAURANTE", "restaurant.use")).toBe(true);
    expect(can("RESTAURANTE", "kitchen.view")).toBe(true);
    expect(can("RESTAURANTE", "menu.manage")).toBe(false);
    expect(can("RESTAURANTE", "restaurant.cancel")).toBe(false);
  });

  it("camareira lança frigobar, mas não abre comanda", () => {
    expect(can("GOVERNANCA", "minibar.post")).toBe(true);
    expect(can("GOVERNANCA", "restaurant.use")).toBe(false);
  });
});
