import { describe, expect, it } from "vitest";
import { addDays, isDateStr, nightsBetween } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { computeTotals, freeByNight, roomReadyReason, stayFields, vehicleSchema } from "@/lib/reservations/rules";
import { compareCleaning, type CleaningCard } from "@/lib/housekeeping/service";

describe("datas de estadia", () => {
  it("conta noites e soma dias atravessando o mês", () => {
    expect(nightsBetween("2026-11-28", "2026-12-02")).toBe(4);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("rejeita datas inexistentes", () => {
    expect(isDateStr("2026-02-30")).toBe(false);
    expect(isDateStr("2026-02-28")).toBe(true);
  });
});

describe("dinheiro", () => {
  it("entende o jeito brasileiro de escrever valores", () => {
    expect(parseBRL("250")).toBe(25000);
    expect(parseBRL("250,5")).toBe(25050);
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("R$ 1.500")).toBe(150000);
    expect(parseBRL("12.50")).toBe(1250);
    expect(parseBRL("abc")).toBeNull();
  });

  it("formata em reais", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
});

describe("valores da reserva", () => {
  it("soma as diárias e o ISS quando cobrado", () => {
    expect(computeTotals({ nights: 3, dailyCents: 20000, chargeIss: true, issBasisPoints: 500 })).toEqual({
      nights: 3,
      lodging: 60000,
      iss: 3000,
      total: 63000,
    });
  });

  it("sem ISS, o total é só a hospedagem", () => {
    expect(computeTotals({ nights: 2, dailyCents: 15000, chargeIss: false, issBasisPoints: 500 }).total).toBe(30000);
  });
});

describe("disponibilidade por noite", () => {
  const nights = ["2026-11-12", "2026-11-13", "2026-11-14"];

  it("desconta as reservas de cada noite", () => {
    const res = [
      { checkIn: "2026-11-12", checkOut: "2026-11-14" },
      { checkIn: "2026-11-13", checkOut: "2026-11-15" },
    ];
    expect(freeByNight(3, res, nights)).toEqual([2, 1, 2]);
  });

  it("quem sai num dia não ocupa a noite desse dia", () => {
    expect(freeByNight(1, [{ checkIn: "2026-11-10", checkOut: "2026-11-12" }], nights)).toEqual([1, 1, 1]);
  });
});

describe("quarto pronto para check-in", () => {
  const ok = { occupancy: "LIVRE", housekeeping: "LIMPO", maintenance: "OK" } as const;

  it("livre e limpo: pode", () => {
    expect(roomReadyReason(ok)).toBeNull();
    expect(roomReadyReason({ ...ok, maintenance: "COM_PROBLEMA" })).toBeNull();
  });

  it("sujo, ocupado, em manutenção ou bloqueado: não pode", () => {
    expect(roomReadyReason({ ...ok, housekeeping: "SUJO" })).toMatch(/limpo/);
    expect(roomReadyReason({ ...ok, occupancy: "OCUPADO" })).toMatch(/ocupado/);
    expect(roomReadyReason({ ...ok, maintenance: "EM_MANUTENCAO" })).toMatch(/manutenção/);
    expect(roomReadyReason({ ...ok, maintenance: "BLOQUEADO" })).toMatch(/bloqueado/);
  });
});

describe("formulário da estadia", () => {
  const base = {
    checkIn: "2026-11-12",
    checkOut: "2026-11-14",
    adults: 2,
    roomTypeId: "6f1c2a3b-1111-4222-8333-944455556666",
    daily: "250,00",
    breakfast: true,
    chargeIss: true,
    issPercent: "5",
  };

  it("aceita uma reserva válida e converte a diária para centavos", () => {
    const r = stayFields.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.daily).toBe(25000);
  });

  it("saída precisa ser depois da entrada", () => {
    expect(stayFields.safeParse({ ...base, checkOut: "2026-11-12" }).success).toBe(false);
  });

  it("recusa diária inválida", () => {
    expect(stayFields.safeParse({ ...base, daily: "duzentos" }).success).toBe(false);
  });
});

describe("placa do veículo", () => {
  it("padroniza a placa", () => {
    const r = vehicleSchema.safeParse({ plate: "abc-1d23" });
    expect(r.success && r.data.plate).toBe("ABC1D23");
  });
});

describe("governança e chegadas", () => {
  const card = (n: string, arrivingToday: boolean, createdAt: string): CleaningCard => ({
    id: n,
    status: "PENDENTE",
    priority: false,
    arrivingToday,
    createdAt,
    startedAt: null,
    finishedAt: null,
    assignedToId: null,
    assignedToName: null,
    finishedByName: null,
    room: { id: n, number: n, floor: 1, typeName: "T", occupancy: "LIVRE", maintenance: "OK" },
  });

  it("quarto com hóspede chegando hoje vai para o topo", () => {
    const list = [card("101", false, "2026-11-12T07:00:00Z"), card("102", true, "2026-11-12T09:00:00Z")].sort(compareCleaning);
    expect(list[0].room.number).toBe("102");
  });
});
