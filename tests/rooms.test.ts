import { describe, expect, it } from "vitest";
import { badges, displayStatus, isSellable, type RoomState } from "@/lib/rooms/status";
import { blockReason, canChangeStatus, cleaningBlockedReason } from "@/lib/rooms/rules";
import { compareRoomNumbers } from "@/lib/rooms/service";

const room = (over: Partial<RoomState> = {}): RoomState => ({
  occupancy: "LIVRE",
  housekeeping: "LIMPO",
  maintenance: "OK",
  ...over,
});

describe("cor do quarto no mapa", () => {
  it("livre e limpo é verde e pode ser vendido", () => {
    expect(displayStatus(room())).toBe("LIVRE");
    expect(isSellable(room())).toBe(true);
  });

  it("segue a prioridade bloqueado > manutenção > ocupado > arrumação > sujo", () => {
    expect(displayStatus(room({ maintenance: "BLOQUEADO", occupancy: "OCUPADO" }))).toBe("BLOQUEADO");
    expect(displayStatus(room({ maintenance: "EM_MANUTENCAO", housekeeping: "SUJO" }))).toBe("EM_MANUTENCAO");
    expect(displayStatus(room({ occupancy: "OCUPADO", housekeeping: "SUJO" }))).toBe("OCUPADO");
    expect(displayStatus(room({ housekeeping: "EM_ARRUMACAO" }))).toBe("EM_ARRUMACAO");
    expect(displayStatus(room({ housekeeping: "SUJO" }))).toBe("SUJO");
  });

  it("problema não muda a cor, vira selo", () => {
    const r = room({ maintenance: "COM_PROBLEMA" });
    expect(displayStatus(r)).toBe("LIVRE");
    expect(badges(r)).toContain("⚠ Problema");
  });

  it("ocupado e sujo mostra o selo de sujo", () => {
    expect(badges(room({ occupancy: "OCUPADO", housekeeping: "SUJO" }))).toEqual(["Sujo"]);
  });

  it("sujo não pode ser vendido", () => {
    expect(isSellable(room({ housekeeping: "SUJO" }))).toBe(false);
  });
});

describe("quem pode mudar o quarto pelo mapa", () => {
  const ok = { maintenance: "OK" as const, occupancy: "LIVRE" as const };

  it("governança muda limpeza, mas não bloqueia", () => {
    expect(canChangeStatus("GOVERNANCA", ok, { field: "housekeeping", value: "LIMPO" })).toBe(true);
    expect(canChangeStatus("GOVERNANCA", ok, { field: "maintenance", value: "BLOQUEADO" })).toBe(false);
  });

  it("manutenção bloqueia, mas não marca como limpo", () => {
    expect(canChangeStatus("MANUTENCAO", ok, { field: "maintenance", value: "BLOQUEADO" })).toBe(true);
    expect(canChangeStatus("MANUTENCAO", ok, { field: "housekeeping", value: "LIMPO" })).toBe(false);
  });

  it("restaurante só olha", () => {
    expect(canChangeStatus("RESTAURANTE", ok, { field: "housekeeping", value: "SUJO" })).toBe(false);
    expect(canChangeStatus("RESTAURANTE", ok, { field: "note", value: "x" })).toBe(false);
  });

  it("não bloqueia quarto ocupado nem desbloqueia o que não está bloqueado", () => {
    expect(blockReason({ maintenance: "OK", occupancy: "OCUPADO" }, { field: "maintenance", value: "BLOQUEADO" })).toMatch(/ocupado/);
    expect(blockReason(ok, { field: "maintenance", value: "OK" })).toMatch(/ocorrências/);
    expect(blockReason({ maintenance: "BLOQUEADO" }, { field: "maintenance", value: "OK" })).toBeNull();
  });

  it("não arruma quarto em manutenção ou bloqueado", () => {
    expect(cleaningBlockedReason("EM_MANUTENCAO")).not.toBeNull();
    expect(cleaningBlockedReason("BLOQUEADO")).not.toBeNull();
    expect(cleaningBlockedReason("COM_PROBLEMA")).toBeNull();
  });
});

describe("ordem dos números de quarto", () => {
  it("ordena como número, não como texto", () => {
    expect(["1010", "102", "101", "204A", "204"].sort(compareRoomNumbers)).toEqual(["101", "102", "204", "204A", "1010"]);
  });
});
