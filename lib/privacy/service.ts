import type { Db } from "@/lib/db-types";
import type { Failure, SessionUser } from "@/lib/auth/service";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { toDateStr } from "@/lib/dates";

// ================================================================
// LGPD — dados dos hóspedes
// Exportar (direito de acesso) e anonimizar (direito de eliminação /
// fim do prazo de guarda). Anonimizar mantém as estadias e os valores
// (contabilidade), mas apaga quem era a pessoa.
// ================================================================

const ANON_PREFIX = "Hóspede anonimizado";

// Tudo o que o hotel guarda sobre a pessoa, num arquivo só.
export async function exportGuest(db: Db, actor: SessionUser, guestId: string) {
  const g = await db.guest.findUnique({
    where: { id: guestId },
    select: {
      fullName: true, docType: true, docNumber: true, docIssuer: true, birthDate: true, gender: true, nationality: true, profession: true,
      phone: true, email: true, address: true, zipCode: true, city: true, state: true, country: true, notes: true, createdAt: true, updatedAt: true,
      reservations: {
        orderBy: { checkIn: "asc" },
        select: {
          number: true, status: true, checkIn: true, checkOut: true, adults: true, children: true, source: true,
          travelPurpose: true, transport: true, arrivingFrom: true, nextDestination: true,
          room: { select: { number: true } },
          vehicles: { select: { plate: true, model: true, color: true } },
          folio: { select: { kind: true, description: true, amountCents: true, businessDate: true } },
        },
      },
      companionOf: { select: { reservation: { select: { number: true, checkIn: true, checkOut: true } } } },
    },
  });
  if (!g) return null;
  await audit(db, "privacy.export", { userId: actor.id, metadata: { guestId } });
  return {
    geradoEm: new Date().toISOString(),
    aviso: "Dados pessoais guardados pelo hotel sobre o titular (LGPD, art. 18).",
    hospede: { ...g, birthDate: g.birthDate ? toDateStr(g.birthDate) : null, reservations: undefined, companionOf: undefined },
    estadias: g.reservations.map((r) => ({
      ...r,
      checkIn: toDateStr(r.checkIn),
      checkOut: toDateStr(r.checkOut),
      quarto: r.room?.number ?? null,
      room: undefined,
      conta: r.folio.map((f) => ({ ...f, businessDate: toDateStr(f.businessDate), valor: f.amountCents / 100, amountCents: undefined })),
      folio: undefined,
    })),
    comoAcompanhante: g.companionOf.map((c) => ({ reserva: c.reservation.number, entrada: toDateStr(c.reservation.checkIn), saida: toDateStr(c.reservation.checkOut) })),
  };
}

// Pode anonimizar? Não com estadia em andamento/futura nem conta pendente aberta.
async function blocker(db: Db, guestId: string): Promise<string | null> {
  const active = await db.reservation.count({ where: { status: { in: ["CONFIRMADA", "HOSPEDADA"] }, OR: [{ guestId }, { companions: { some: { guestId } } }] } });
  if (active) return "O hóspede tem reserva ativa ou futura. Anonimize depois da estadia.";
  const pending = await db.pendingAccount.count({ where: { guestId, status: "ABERTA" } });
  if (pending) return "O hóspede tem conta pendente em aberto.";
  return null;
}

async function wipe(db: Db, guestId: string) {
  await db.guest.update({
    where: { id: guestId },
    data: {
      fullName: `${ANON_PREFIX} ${guestId.slice(0, 8)}`,
      docType: null, docNumber: null, docIssuer: null, birthDate: null, gender: null, profession: null,
      phone: null, email: null, address: null, zipCode: null, notes: null,
      // cidade/estado/país e nacionalidade ficam (estatística, sem identificar a pessoa)
    },
  });
  // placas de veículo também identificam a pessoa
  await db.vehicle.updateMany({
    where: { reservation: { OR: [{ guestId }] } },
    data: { plate: "ANONIM", model: null, color: null },
  });
}

export async function anonymizeGuest(db: Db, actor: SessionUser, guestId: string): Promise<{ ok: true } | Failure> {
  if (!can(actor.role, "settings.manage")) return { ok: false, error: "Só gerente ou administrador pode anonimizar hóspedes." };
  const g = await db.guest.findUnique({ where: { id: guestId }, select: { fullName: true } });
  if (!g) return { ok: false, error: "Hóspede não encontrado." };
  if (g.fullName.startsWith(ANON_PREFIX)) return { ok: false, error: "Este hóspede já foi anonimizado." };
  const b = await blocker(db, guestId);
  if (b) return { ok: false, error: b };
  await wipe(db, guestId);
  await audit(db, "privacy.anonymize", { userId: actor.id, metadata: { guestId } });
  return { ok: true };
}

// Hóspedes cuja última estadia terminou há mais de X anos.
async function oldGuests(db: Db, years: number) {
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - years);
  const rows = await db.guest.findMany({
    where: {
      NOT: { fullName: { startsWith: ANON_PREFIX } },
      reservations: { none: { checkOut: { gte: limit } } },
      companionOf: { none: { reservation: { checkOut: { gte: limit } } } },
      pending: { none: { status: "ABERTA" } },
      createdAt: { lt: limit },
    },
    select: { id: true },
    take: 5000,
  });
  return rows.map((r) => r.id);
}

export async function countOldGuests(db: Db, years: number) {
  return (await oldGuests(db, years)).length;
}

export async function anonymizeOld(db: Db, actor: SessionUser, years: number): Promise<{ ok: true; count: number } | Failure> {
  if (!can(actor.role, "settings.manage")) return { ok: false, error: "Só gerente ou administrador pode anonimizar hóspedes." };
  if (!Number.isInteger(years) || years < 1 || years > 30) return { ok: false, error: "Informe o prazo em anos (1 a 30)." };
  const ids = await oldGuests(db, years);
  for (const id of ids) await wipe(db, id);
  await audit(db, "privacy.anonymize.bulk", { userId: actor.id, metadata: { years, count: ids.length } });
  return { ok: true, count: ids.length };
}
