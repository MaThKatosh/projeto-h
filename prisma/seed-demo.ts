import "dotenv/config";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { addDays, type DateStr } from "@/lib/dates";
import { getBusinessDate } from "@/lib/hotel-date";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";
import { applyRoomChanges } from "@/lib/rooms/service";
import { checkIn, createReservation } from "@/lib/reservations/service";
import { createTicket } from "@/lib/maintenance/service";
import { postOutletCharge } from "@/lib/folio/service";

// ================================================================
// HOTEL DE DEMONSTRAÇÃO (versão de teste / beta)
// Só roda num banco vazio de reservas. Usa as regras normais do sistema
// (reserva, check-in com fichas completas, ocorrência...) para os dados
// ficarem iguais aos de um hotel de verdade.
// ================================================================

// CPF fictício, mas válido (dígitos verificadores certos).
function cpf(seed: number): string {
  const base = String(100000000 + ((seed * 7919) % 899999999)).slice(0, 9).split("").map(Number);
  const dv = (d: number[]) => {
    const s = d.reduce((acc, n, i) => acc + n * (d.length + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael", "Sofia", "Tiago"];
const LAST = ["Silva", "Souza", "Oliveira", "Santos", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Ribeiro"];
const CITIES: [string, string][] = [["São Paulo", "SP"], ["Rio de Janeiro", "RJ"], ["Belo Horizonte", "MG"], ["Curitiba", "PR"], ["Porto Alegre", "RS"], ["Salvador", "BA"], ["Recife", "PE"], ["Campinas", "SP"]];

let n = 0;
function person(i: number) {
  n++;
  const [city, state] = CITIES[i % CITIES.length];
  const first = FIRST[i % FIRST.length];
  const last = `${LAST[(i * 5) % LAST.length]} ${LAST[(i * 7 + 3) % LAST.length]}`;
  return {
    fullName: `${first} ${last}`,
    docType: "CPF",
    docNumber: cpf(1000 + i),
    phone: `11 9${String(80000000 + i * 1371).slice(0, 8)}`,
    email: `${first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.teste${i}@exemplo.com`,
    birthDate: `${1960 + ((i * 3) % 40)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
    nationality: "Brasil",
    gender: i % 2 ? "M" : "F",
    city,
    state,
    country: "Brasil",
    zipCode: "01001-000",
    address: `Rua de Teste, ${100 + i}`,
  };
}

async function main() {
  const db = getDb();
  if ((await db.reservation.count()) > 0) {
    console.log("[demo] já tem reservas: hotel de demonstração não recriado.");
    return;
  }

  await db.setting.upsert({ where: { key: "hotelName" }, update: { value: "Hotel Demonstração" }, create: { key: "hotelName", value: "Hotel Demonstração" } });

  // Contas de teste (uma por cargo)
  const hash = await hashPassword(DEMO_PASSWORD);
  for (const a of DEMO_ACCOUNTS) {
    await db.user.upsert({ where: { username: a.username }, update: {}, create: { username: a.username, fullName: a.fullName, role: a.role, passwordHash: hash } });
  }
  const actor = await db.user.findUniqueOrThrow({ where: { username: "gerente" }, select: { id: true, username: true, fullName: true, role: true } });

  // Quartos: 3 andares de 8, todos limpos e livres
  if ((await db.room.count()) === 0) {
    const t = await Promise.all(
      [
        { name: "Standard Solteiro", capacity: 1 },
        { name: "Standard Casal", capacity: 2 },
        { name: "Luxo", capacity: 3 },
        { name: "Suíte", capacity: 4 },
      ].map((x) => db.roomType.upsert({ where: { name: x.name }, update: {}, create: x }))
    );
    for (const floor of [1, 2, 3]) {
      for (let k = 1; k <= 8; k++) {
        const type = floor === 3 ? (k <= 5 ? t[2] : t[3]) : k <= 2 ? t[0] : t[1];
        await db.room.create({ data: { number: `${floor}${String(k).padStart(2, "0")}`, floor, roomTypeId: type.id } });
      }
    }
  }
  const types = await db.roomType.findMany({ select: { id: true, name: true, capacity: true } });
  const typeId = (name: string) => types.find((x) => x.name === name)!.id;

  // Preços da tarifa Balcão (a etapa de dados roda antes de existirem tipos)
  const plan = await db.ratePlan.upsert({ where: { name: "Balcão" }, update: {}, create: { name: "Balcão", includesBreakfast: true, chargeIss: true, issBasisPoints: 500 } });
  const price: Record<string, number> = { "Standard Solteiro": 15000, "Standard Casal": 21000, Luxo: 27000, Suíte: 35000 };
  for (const x of types) {
    await db.ratePrice.upsert({
      where: { ratePlanId_roomTypeId: { ratePlanId: plan.id, roomTypeId: x.id } },
      update: {},
      create: { ratePlanId: plan.id, roomTypeId: x.id, dailyCents: price[x.name] ?? 20000 },
    });
  }
  await db.revenueRule.create({ data: { name: "Fim de semana", kind: "DIA_SEMANA", params: { days: [5, 6] }, adjustBp: 1000 } });

  const today = await getBusinessDate(db);
  const rooms = await db.room.findMany({ orderBy: { number: "asc" }, select: { id: true, number: true, roomTypeId: true } });
  const room = (num: string) => rooms.find((r) => r.number === num)!;
  const daily = (name: string) => ((price[name] ?? 20000) / 100).toFixed(2).replace(".", ",");

  async function reserve(i: number, typeName: string, from: DateStr, nights: number, opts: { roomNumber?: string; adults?: number; checkin?: boolean; source?: string } = {}) {
    const adults = opts.adults ?? Math.min(2, types.find((x) => x.name === typeName)!.capacity);
    const holder = person(i);
    const stay = {
      checkIn: from,
      checkOut: addDays(from, nights),
      adults,
      children: 0,
      roomTypeId: typeId(typeName),
      ratePlanId: plan.id,
      daily: daily(typeName),
      breakfast: true,
      chargeIss: true,
      issPercent: 5,
      source: opts.source ?? "BALCAO",
      roomId: opts.roomNumber ? room(opts.roomNumber).id : undefined,
    };
    return db.$transaction(async (tx) => {
      const r = await createReservation(tx, actor, { guest: holder, stay });
      if (!r.ok) throw new Error(`reserva ${holder.fullName}: ${r.error}`);
      if (opts.checkin && opts.roomNumber) {
        const companions = Array.from({ length: adults - 1 }, (_, c) => ({ ...person(i + 100 + c), address: holder.address, city: holder.city, state: holder.state, phone: holder.phone }));
        const c = await checkIn(tx, actor, r.id, {
          roomId: room(opts.roomNumber).id,
          guest: holder,
          companions,
          trip: { travelPurpose: i % 2 ? "LAZER" : "NEGOCIOS", transport: i % 3 ? "CARRO" : "AVIAO", arrivingFrom: "São Paulo/SP", nextDestination: "" },
        });
        if (!c.ok) throw new Error(`check-in ${holder.fullName}: ${c.error}`);
      }
      return r.id;
    });
  }

  // Hóspedes na casa
  const inHouse: [string, string, number][] = [
    ["101", "Standard Solteiro", 2], ["103", "Standard Casal", 3], ["104", "Standard Casal", 1], ["106", "Standard Casal", 4],
    ["203", "Standard Casal", 2], ["205", "Standard Casal", 1], ["301", "Luxo", 3], ["306", "Suíte", 2],
  ];
  const ids: string[] = [];
  for (const [i, [num, typeName, nights]] of inHouse.entries()) {
    ids.push(await reserve(i, typeName, today, nights, { roomNumber: num, checkin: true, adults: typeName === "Standard Solteiro" ? 1 : 2 }));
  }
  // Algum consumo nas contas
  await postOutletCharge(db, actor.id, ids[0], { category: "FRIGOBAR", description: "Frigobar: Água mineral", quantity: 2, unitCents: 700 });
  await postOutletCharge(db, actor.id, ids[4], { category: "FRIGOBAR", description: "Frigobar: Chocolate", quantity: 1, unitCents: 900 });

  // Chegadas de hoje (para o testador fazer o check-in)
  await reserve(20, "Standard Casal", today, 2, { roomNumber: "107" });
  await reserve(21, "Luxo", today, 3, { source: "BOOKING" });
  await reserve(22, "Standard Solteiro", today, 1, { adults: 1 });

  // Reservas futuras
  const future: [number, string, number, number][] = [[1, "Standard Casal", 2, 23], [2, "Luxo", 3, 24], [3, "Suíte", 2, 25], [5, "Standard Casal", 4, 26], [8, "Standard Solteiro", 1, 27], [10, "Luxo", 2, 28]];
  for (const [d, typeName, nights, i] of future) await reserve(i, typeName, addDays(today, d), nights, { source: d % 2 ? "BOOKING" : "TELEFONE" });

  // Quartos sujos / em manutenção (para a governança e a manutenção testarem)
  for (const num of ["102", "108", "204", "302"]) await applyRoomChanges(db, actor, room(num).id, { housekeeping: "SUJO" });
  await db.$transaction((tx) => createTicket(tx, actor, { roomId: room("208").id, title: "Chuveiro sem água quente", description: "Hóspede anterior reclamou.", priority: "MEDIA" }));
  await db.$transaction((tx) => createTicket(tx, actor, { roomId: room("304").id, title: "Ar-condicionado pingando", priority: "ALTA", outOfOrder: true }));

  console.log(`[demo] hotel de demonstração criado: ${rooms.length} quartos, ${n} hóspedes de teste.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
