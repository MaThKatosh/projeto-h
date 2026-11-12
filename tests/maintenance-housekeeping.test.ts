import { describe, expect, it } from "vitest";
import { canDo, createTicketSchema, deriveMaintenance } from "@/lib/maintenance/rules";
import { compareCleaning, type CleaningCard } from "@/lib/housekeeping/service";
import { compareTickets, type TicketCard } from "@/lib/maintenance/service";

describe("situação do quarto calculada pelas ocorrências", () => {
  it("sem ocorrência aberta: OK", () => {
    expect(deriveMaintenance("COM_PROBLEMA", [{ status: "RESOLVIDA", outOfOrder: true }])).toBe("OK");
  });

  it("ocorrência aberta: com problema", () => {
    expect(deriveMaintenance("OK", [{ status: "ABERTA", outOfOrder: false }])).toBe("COM_PROBLEMA");
    expect(deriveMaintenance("OK", [{ status: "AGUARDANDO", outOfOrder: false }])).toBe("COM_PROBLEMA");
  });

  it("ocorrência aberta que tira de venda: em manutenção", () => {
    expect(
      deriveMaintenance("OK", [
        { status: "ABERTA", outOfOrder: false },
        { status: "EM_ANDAMENTO", outOfOrder: true },
      ])
    ).toBe("EM_MANUTENCAO");
  });

  it("bloqueio manual vence as ocorrências", () => {
    expect(deriveMaintenance("BLOQUEADO", [])).toBe("BLOQUEADO");
  });
});

describe("ações da ocorrência", () => {
  it("só reabre o que está encerrado", () => {
    expect(canDo("reabrir", "RESOLVIDA")).toBe(true);
    expect(canDo("reabrir", "ABERTA")).toBe(false);
  });

  it("não resolve de novo o que já foi resolvido", () => {
    expect(canDo("resolver", "RESOLVIDA")).toBe(false);
    expect(canDo("resolver", "AGUARDANDO")).toBe(true);
  });

  it("exige quarto ou local, e só quarto fica fora de venda", () => {
    expect(createTicketSchema.safeParse({ title: "Lâmpada queimada" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ title: "Lâmpada queimada", location: "Piscina" }).success).toBe(true);
    expect(createTicketSchema.safeParse({ title: "Vazamento", location: "Piscina", outOfOrder: true }).success).toBe(false);
  });
});

const cleaning = (over: Partial<CleaningCard> & { occupancy?: "LIVRE" | "OCUPADO"; n?: string }): CleaningCard => ({
  id: over.n ?? "x",
  status: "PENDENTE",
  priority: over.priority ?? false,
  arrivingToday: over.arrivingToday ?? false,
  createdAt: over.createdAt ?? "2026-11-12T10:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  assignedToId: null,
  assignedToName: null,
  finishedByName: null,
  room: { id: "r", number: over.n ?? "101", floor: 1, typeName: "T", occupancy: over.occupancy ?? "LIVRE", maintenance: "OK" },
});

describe("ordem de arrumação", () => {
  it("prioridade > quarto livre > mais antigo", () => {
    const list = [
      cleaning({ n: "301", occupancy: "OCUPADO", createdAt: "2026-11-12T08:00:00.000Z" }),
      cleaning({ n: "302", createdAt: "2026-11-12T09:00:00.000Z" }),
      cleaning({ n: "303", occupancy: "OCUPADO", priority: true }),
      cleaning({ n: "304", createdAt: "2026-11-12T07:00:00.000Z" }),
    ].sort(compareCleaning);
    expect(list.map((c) => c.room.number)).toEqual(["303", "304", "302", "301"]);
  });
});

describe("ordem das ocorrências", () => {
  const t = (n: number, priority: TicketCard["priority"], createdAt: string) =>
    ({ number: n, priority, createdAt }) as TicketCard;

  it("urgente primeiro; empate: a mais antiga", () => {
    const list = [
      t(1, "BAIXA", "2026-11-12T01:00:00Z"),
      t(2, "URGENTE", "2026-11-12T05:00:00Z"),
      t(3, "ALTA", "2026-11-12T03:00:00Z"),
      t(4, "ALTA", "2026-11-12T02:00:00Z"),
    ].sort(compareTickets);
    expect(list.map((x) => x.number)).toEqual([2, 4, 3, 1]);
  });
});
