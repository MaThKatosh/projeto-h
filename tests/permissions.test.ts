import { describe, expect, it } from "vitest";
import { can, canManageRole, manageableRoles } from "@/lib/permissions";

describe("hierarquia de usuários", () => {
  it("administrador gerencia todos, inclusive outros administradores", () => {
    expect(manageableRoles("ADMIN")).toHaveLength(6);
  });

  it("gerente gerencia só cargos abaixo do seu", () => {
    expect(canManageRole("GERENTE", "RECEPCAO")).toBe(true);
    expect(canManageRole("GERENTE", "GERENTE")).toBe(false);
    expect(canManageRole("GERENTE", "ADMIN")).toBe(false);
  });

  it("recepção não gerencia usuários", () => {
    expect(can("RECEPCAO", "users.manage")).toBe(false);
    expect(canManageRole("RECEPCAO", "GOVERNANCA")).toBe(false);
  });

  it("todos veem o mapa; só chefia cadastra quartos", () => {
    expect(can("RESTAURANTE", "rooms.view")).toBe(true);
    expect(can("RECEPCAO", "rooms.manage")).toBe(false);
    expect(can("GERENTE", "rooms.manage")).toBe(true);
  });
});
