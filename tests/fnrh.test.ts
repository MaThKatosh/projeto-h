import { describe, expect, it } from "vitest";
import { missingFnrh, tripSchema } from "@/lib/guests/fnrh";
import { guestSchema } from "@/lib/reservations/rules";

const base = { fullName: "Ana Souza", docNumber: null, birthDate: null, nationality: null, gender: null, city: null, country: null };

describe("FNRH", () => {
  it("aponta o que falta na ficha", () => {
    expect(missingFnrh(base)).toEqual(["documento", "nascimento", "nacionalidade", "sexo", "residência"]);
    expect(
      missingFnrh({ ...base, docNumber: "123", birthDate: "1990-01-01", nationality: "Brasileira", gender: "F", country: "Brasil" })
    ).toEqual([]);
  });

  it("dados da viagem aceitam vazio e recusam valores fora da lista", () => {
    expect(tripSchema.parse({ travelPurpose: "", transport: "", arrivingFrom: "", nextDestination: "" })).toEqual({
      travelPurpose: null,
      transport: null,
      arrivingFrom: null,
      nextDestination: null,
    });
    expect(tripSchema.parse({ travelPurpose: "LAZER", transport: "CARRO", arrivingFrom: "Campinas/SP" }).transport).toBe("CARRO");
    expect(tripSchema.safeParse({ travelPurpose: "FERIAS" }).success).toBe(false);
  });

  it("cadastro do hóspede guarda os campos novos (e funciona sem eles)", () => {
    const full = guestSchema.parse({ fullName: "Ana Souza", gender: "F", profession: "Médica", zipCode: "01001-000", country: "Brasil" });
    expect(full).toMatchObject({ gender: "F", profession: "Médica", zipCode: "01001-000", country: "Brasil" });
    const compact = guestSchema.parse({ fullName: "Ana Souza" });
    expect(compact.gender).toBeNull();
    expect(guestSchema.safeParse({ fullName: "Ana Souza", gender: "X" }).success).toBe(false);
  });
});
