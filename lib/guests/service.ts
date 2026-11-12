import type { Db } from "@/lib/db-types";
import { fromDateStr, toDateStr } from "@/lib/dates";
import type { GuestInput } from "@/lib/reservations/rules";

// ================================================================
// HÓSPEDES
// ================================================================

export type GuestView = {
  id: string;
  fullName: string;
  docType: string | null;
  docNumber: string | null;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  nationality: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

export const guestSelect = {
  id: true,
  fullName: true,
  docType: true,
  docNumber: true,
  phone: true,
  email: true,
  birthDate: true,
  nationality: true,
  city: true,
  state: true,
  notes: true,
} as const;

export function toGuestView(g: {
  id: string;
  fullName: string;
  docType: string | null;
  docNumber: string | null;
  phone: string | null;
  email: string | null;
  birthDate: Date | null;
  nationality: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
}): GuestView {
  return { ...g, birthDate: g.birthDate ? toDateStr(g.birthDate) : null };
}

export function guestData(input: GuestInput) {
  return {
    fullName: input.fullName,
    docType: input.docType ?? null,
    // CPF guardado só com números (busca funciona com ou sem pontuação).
    docNumber: input.docNumber
      ? input.docType === "CPF"
        ? input.docNumber.replace(/\D/g, "")
        : input.docNumber.toUpperCase().replace(/\s/g, "")
      : null,
    phone: input.phone,
    email: input.email,
    birthDate: input.birthDate ? fromDateStr(input.birthDate) : null,
    nationality: input.nationality,
    city: input.city,
    state: input.state,
    notes: input.notes,
  };
}

// Busca por nome, documento ou telefone (para não cadastrar duas vezes).
export async function searchGuests(db: Db, query: string, take = 8): Promise<(GuestView & { stays: number })[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, "");
  const rows = await db.guest.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ docNumber: { contains: digits } }, { phone: { contains: digits } }] : []),
        { docNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { ...guestSelect, _count: { select: { reservations: true } } },
    orderBy: { updatedAt: "desc" },
    take,
  });
  return rows.map(({ _count, ...g }) => ({ ...toGuestView(g), stays: _count.reservations }));
}
