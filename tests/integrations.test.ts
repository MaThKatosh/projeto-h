import { describe, expect, it } from "vitest";
import { guessRoomType, parseCsv, parseDate, parseMoney, parseReservationsFile, TEMPLATE_CSV } from "@/lib/integrations/parse";

describe("leitura de CSV", () => {
  it("detecta ; ou , e respeita aspas", () => {
    expect(parseCsv('a;b\r\n"x;1";"di""z"\n')).toEqual([["a", "b"], ["x;1", 'di"z']]);
    expect(parseCsv("﻿a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("datas e valores dos portais", () => {
  it("datas em vários formatos", () => {
    expect(parseDate("2026-12-20")).toBe("2026-12-20");
    expect(parseDate("2026-12-20 14:00:00")).toBe("2026-12-20");
    expect(parseDate("20/12/2026")).toBe("2026-12-20");
    expect(parseDate("12/20/2026")).toBe("2026-12-20"); // só pode ser mês/dia
    expect(parseDate("20 Dec 2026")).toBe("2026-12-20");
    expect(parseDate("20 de dez de 2026")).toBe("2026-12-20");
    expect(parseDate("Dec 20, 2026")).toBe("2026-12-20");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("amanhã")).toBeNull();
  });

  it("valores em reais, dólar-estilo e com moeda", () => {
    expect(parseMoney("R$ 1.234,56")).toBe(123456);
    expect(parseMoney("1,234.56 BRL")).toBe(123456);
    expect(parseMoney("BRL 450")).toBe(45000);
    expect(parseMoney("450.5")).toBe(45050);
    expect(parseMoney("1.234")).toBe(123400);
    expect(parseMoney("—")).toBeNull();
  });
});

describe("arquivo de reservas", () => {
  it("Booking.com em português", () => {
    const csv =
      "Número da reserva;Reservado por;Nome(s) do(s) hóspede(s);Check-in;Check-out;Status;Quartos;Pessoas;Adultos;Crianças;Preço;Tipo de unidade\n" +
      "4455667788;Ana Lima;Ana Lima;2026-12-20;2026-12-23;ok;1;2;2;0;900 BRL;Quarto Duplo Standard\n" +
      "4455667799;João Reis;João Reis;2026-12-21;2026-12-22;cancelled_by_guest;1;1;1;0;300 BRL;Quarto Duplo Standard\n";
    const r = parseReservationsFile(csv);
    expect(r.missingColumns).toEqual([]);
    expect(r.rows[0].data).toMatchObject({ externalCode: "4455667788", guestName: "Ana Lima", checkIn: "2026-12-20", checkOut: "2026-12-23", adults: 2, totalCents: 90000, cancelled: false, roomTypeLabel: "Quarto Duplo Standard" });
    expect(r.rows[1].data?.cancelled).toBe(true);
  });

  it("Expedia / Hoteis.com em inglês", () => {
    const csv =
      "Reservation ID,Guest,Check-In,Check-Out,Room,Status,Booking Amount,Adults,Children\n" +
      '998877,"Smith, John",Dec 20 2026,Dec 22 2026,Deluxe King,Booked,"1,200.00",2,1\n';
    const r = parseReservationsFile(csv);
    expect(r.rows[0].data).toMatchObject({ externalCode: "998877", guestName: "Smith, John", checkIn: "2026-12-20", checkOut: "2026-12-22", adults: 2, children: 1, totalCents: 120000 });
  });

  it("modelo do sistema", () => {
    const r = parseReservationsFile(TEMPLATE_CSV);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].data).toMatchObject({ externalCode: "ABC123", email: "maria@exemplo.com", totalCents: 90000, notes: "Chega tarde" });
  });

  it("aponta colunas que faltam e linhas com problema", () => {
    expect(parseReservationsFile("nome;cidade\nAna;SP").missingColumns).toContain("número da reserva");
    const r = parseReservationsFile("codigo;hospede;entrada;saida\nX1;Ana;20/12/2026;19/12/2026\nX2;;20/12/2026;21/12/2026");
    expect(r.rows.map((x) => x.error)).toEqual(["saída não é depois da entrada", "sem nome do hóspede"]);
  });
});

describe("tipo de quarto do portal → do hotel", () => {
  const types = [
    { id: "a", name: "Standard Casal" },
    { id: "b", name: "Standard Solteiro" },
    { id: "c", name: "Luxo" },
    { id: "d", name: "Suíte" },
  ];
  it("acha o parecido e deixa a pessoa escolher quando empata", () => {
    expect(guessRoomType("standard casal", types)).toBe("a");
    expect(guessRoomType("Quarto Luxo com Vista", types)).toBe("c");
    expect(guessRoomType("Suite Master", types)).toBe("d");
    expect(guessRoomType("Quarto Standard", types)).toBeNull(); // casal ou solteiro?
    expect(guessRoomType("Chalé", types)).toBeNull();
  });
});
