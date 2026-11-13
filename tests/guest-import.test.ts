import { describe, expect, it } from "vitest";
import { parseGuestsFile } from "@/lib/guests/import";

describe("importar hóspedes do sistema antigo", () => {
  it("reconhece colunas comuns e formata os dados", () => {
    const csv =
      "Nome;CPF;Data de Nascimento;E-mail;Celular;Sexo;Cidade;UF;CEP\n" +
      "Maria da Silva;529.982.247-25;20/05/1985;maria@exemplo.com;11 99999-0000;Feminino;São Paulo;SP;01001000\n" +
      "John Smith;X1234567;1970-01-02;john@example.com;;M;London;;\n";
    const r = parseGuestsFile(csv);
    expect(r.missing).toEqual([]);
    expect(r.rows[0].data).toMatchObject({ fullName: "Maria da Silva", docType: "CPF", birthDate: "1985-05-20", gender: "F", city: "São Paulo", state: "SP", country: "Brasil", zipCode: "01001-000" });
    expect(r.rows[1].data).toMatchObject({ fullName: "John Smith", docType: "PASSAPORTE", gender: "M" });
  });

  it("aponta linhas com problema (CPF inválido, data impossível)", () => {
    const csv = "nome;cpf;nascimento\nAna Lima;111.111.111-11;\nBruno Reis;;11/11/1111\n";
    const r = parseGuestsFile(csv);
    expect(r.rows[0].error).toMatch(/CPF/);
    expect(r.rows[1].error).toMatch(/nascimento|120 anos/i);
  });

  it("exige a coluna de nome", () => {
    expect(parseGuestsFile("cpf;email\n123;a@b.com").missing).toContain("nome do hóspede");
  });
});
