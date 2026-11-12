import { describe, expect, it } from "vitest";
import { missingFnrh, tripSchema } from "@/lib/guests/fnrh";
import { birthDateProblem, isValidCpf, normalizeCep } from "@/lib/guests/validate";
import { countryOptions, normalizeCountry } from "@/lib/guests/countries";
import { guestSchema } from "@/lib/reservations/rules";

const base = { fullName: "Ana Souza", docNumber: null, birthDate: null, nationality: null, gender: null, city: null, state: null, country: null };

describe("FNRH", () => {
  it("aponta o que falta na ficha", () => {
    expect(missingFnrh(base)).toEqual(["documento", "nascimento", "nacionalidade", "sexo", "país de residência", "cidade"]);
    expect(missingFnrh({ ...base, fullName: "Ana" })).toContain("nome e sobrenome");
    const full = { ...base, docNumber: "123", birthDate: "1990-01-01", nationality: "Brasil", gender: "F", city: "Santos", country: "Brasil" };
    expect(missingFnrh(full)).toEqual(["estado"]); // no Brasil precisa do estado
    expect(missingFnrh({ ...full, state: "SP" })).toEqual([]);
    expect(missingFnrh({ ...full, country: "Argentina" })).toEqual([]);
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
    const full = guestSchema.parse({ fullName: "Ana Souza", gender: "F", profession: "Médica", zipCode: "01001000", country: "Brasil" });
    expect(full).toMatchObject({ gender: "F", profession: "Médica", zipCode: "01001-000", country: "Brasil" });
    const compact = guestSchema.parse({ fullName: "Ana Souza" });
    expect(compact.gender).toBeNull();
    expect(guestSchema.safeParse({ fullName: "Ana Souza", gender: "X" }).success).toBe(false);
  });
});

describe("validação da ficha", () => {
  it("CPF com dígitos verificadores", () => {
    expect(isValidCpf("123.456.789-09")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("123.456.789-00")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("1234")).toBe(false);
    expect(guestSchema.safeParse({ fullName: "Ana Souza", docType: "CPF", docNumber: "111.111.111-11" }).success).toBe(false);
    // passaporte não passa pela regra do CPF
    expect(guestSchema.safeParse({ fullName: "John Smith", docType: "PASSAPORTE", docNumber: "X1234567" }).success).toBe(true);
  });

  it("nascimento possível", () => {
    const today = new Date(2026, 10, 12);
    expect(birthDateProblem("1990-05-20", today)).toBeNull();
    expect(birthDateProblem("1111-11-11", today)).toMatch(/120 anos/);
    expect(birthDateProblem("2027-01-01", today)).toMatch(/futuro/);
    expect(birthDateProblem("2026-02-30", today)).toBe("Data inválida.");
    expect(guestSchema.safeParse({ fullName: "Ana Souza", birthDate: "1111-11-11" }).success).toBe(false);
  });

  it("CEP do Brasil com 8 números (estrangeiro fica livre)", () => {
    expect(normalizeCep("01001000")).toBe("01001-000");
    expect(normalizeCep("01001-000")).toBe("01001-000");
    expect(normalizeCep("123")).toBeNull();
    expect(normalizeCep("00000-000")).toBeNull();
    expect(guestSchema.safeParse({ fullName: "Ana Souza", zipCode: "123", country: "Brasil" }).success).toBe(false);
    expect(guestSchema.safeParse({ fullName: "John Smith", zipCode: "SW1A 1AA", country: "Reino Unido" }).success).toBe(true);
  });

  it("países: Brasil primeiro, nome no idioma da tela, valor antigo preservado", () => {
    const pt = countryOptions("pt-BR");
    expect(pt[0]).toEqual({ value: "Brasil", label: "Brasil" });
    expect(countryOptions("en").find((o) => o.value === "Alemanha")?.label).toBe("Germany");
    expect(countryOptions("es").find((o) => o.value === "Alemanha")?.label).toBe("Alemania");
    expect(countryOptions("pt-BR", "Terra Média")[0].value).toBe("Terra Média");
    expect(normalizeCountry("Brasileira")).toBe("Brasil");
  });
});
